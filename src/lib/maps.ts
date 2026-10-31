import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { blobToDataUrl, fitImage, shrinkImage } from './image'
import { newId } from './id'
import { cellBox, tokenSquares, type FogCover } from './grid'
import type { MapGrid, MapLayer, MapLight, MapRecord, Wall } from '../types'

/**
 * Maps and handouts. The DM keeps them in the Maps tab and can show one to the players, exactly like showing a character sheet (`spotlight.ts`): the player
 * screen shows the picture instead of the combat feed until it is switched off. Only one thing is shown at a time (a map or a sheet).
 *
 * Fog of war = layers on a map (below). The picture sent to the table is COMPOSED here in the DM's browser, because anything sent as-is can be pulled out of
 * the network traffic. `publicMap()` is the single place that decides what goes out.
 */
export interface MapShown {
  mapId: number
}

export type PictureKind = 'map' | 'image'

const KEY = 'mapShown'

/** Maps, or with `kind` only the maps / only the story images (both live in the `maps` table; no kind = a map). */
export const useMaps = (kind?: PictureKind) =>
  useLiveQuery(async () => (await db.maps.orderBy('name').toArray()).filter((m) => !kind || (m.kind ?? 'map') === kind), [kind]) ?? []
export const useMapShown = () => useLiveQuery(async () => ((await db.kv.get(KEY))?.value as MapShown | undefined) ?? null, [])

/** 1800 px is sharp on a phone and a TV and keeps the file a few hundred kilobytes (it travels as JSON to the table). */
export const addMap = async (file: File, kind: PictureKind = 'map', folder = '') =>
  db.maps.add({
    name: file.name.replace(/\.[^.]+$/, '') || (kind === 'map' ? 'Map' : 'Image'),
    ...(kind === 'image' ? { kind } : {}),
    ...(folder ? { folder } : {}),
    image: await shrinkImage(file, 1800),
  })
export const renameMap = (id: number, name: string) => db.maps.update(id, { name })

/**
 * Folders (maps and story images each have their own tree). A picture holds its folder as a path ('Dungeons/Level 1', none = top level); the folders that exist
 * are those paths and their parents, plus the ones kept in kv `mapFolders:<kind>` so an empty folder survives. Nothing here is sent to the players.
 */
const foldersKey = (kind: PictureKind) => `mapFolders:${kind}`
export const useFolders = (kind: PictureKind) =>
  useLiveQuery(async () => ((await db.kv.get(foldersKey(kind)))?.value as string[] | undefined) ?? [], [kind]) ?? []
export const joinPath = (parent: string, name: string) => (parent ? `${parent}/${name}` : name)
export const parentPath = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')))
export const folderName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
/** Every folder path that exists, parents included, sorted so a parent comes before its children. */
export const allFolders = (explicit: string[], pictures: MapRecord[]) => {
  const out = new Set<string>()
  for (const p of [...explicit, ...pictures.map((m) => m.folder ?? '')])
    p.split('/').filter(Boolean).forEach((_, i, parts) => out.add(parts.slice(0, i + 1).join('/')))
  return [...out].sort((a, b) => a.localeCompare(b))
}
export const inFolder = (path: string, folder?: string) => folder === path || !!folder?.startsWith(`${path}/`)

/** Rewrites every folder path (pictures of this kind and the kept list) with `fn`; '' means the top level. */
const rewriteFolders = (kind: PictureKind, fn: (path: string) => string) =>
  db.transaction('rw', db.maps, db.kv, async () => {
    const list = ((await db.kv.get(foldersKey(kind)))?.value as string[] | undefined) ?? []
    await db.kv.put({ key: foldersKey(kind), value: [...new Set(list.map(fn).filter(Boolean))] })
    for (const m of await db.maps.toArray()) {
      if ((m.kind ?? 'map') !== kind || !m.folder) continue
      const folder = fn(m.folder)
      if (folder !== m.folder) await db.maps.update(m.id!, { folder: folder || undefined })
    }
  })
export const createFolder = (kind: PictureKind, path: string) =>
  db.transaction('rw', db.kv, async () => {
    const list = ((await db.kv.get(foldersKey(kind)))?.value as string[] | undefined) ?? []
    await db.kv.put({ key: foldersKey(kind), value: [...new Set([...list, path])] })
  })
export const renameFolder = (kind: PictureKind, path: string, name: string) => {
  const to = joinPath(parentPath(path), name)
  return rewriteFolders(kind, (p) => (inFolder(path, p) ? to + p.slice(path.length) : p))
}
/** The pictures and folders inside move up one level, so nothing is lost. */
export const deleteFolder = (kind: PictureKind, path: string) =>
  rewriteFolders(kind, (p) => (p === path ? parentPath(path) : inFolder(path, p) ? joinPath(parentPath(path), p.slice(path.length + 1)) : p))
export const moveMap = (id: number, folder: string) => db.maps.update(id, { folder: folder || undefined })

export async function showMap(mapId: number) {
  await db.kv.delete('spotlight') // one thing at a time
  await db.kv.put({ key: KEY, value: { mapId } satisfies MapShown })
}
export const stopShowingMap = () => db.kv.delete(KEY)
export async function deleteMap(id: number) {
  const shown = (await db.kv.get(KEY))?.value as MapShown | undefined
  if (shown?.mapId === id) await stopShowingMap()
  await db.maps.delete(id)
  await db.kv.delete(`fog:${id}`) // what was explored on it (lib/fog.ts)
}

/** Layers: the DM adds same-sized overlay pictures (fog of war...) and switches each on or off. They are stored on the map, so the switches are remembered when the map is hidden and shown again. */
const sizes = new WeakMap<Blob, readonly [number, number]>()
/** The picture's size in pixels (decoded once per picture: the fog of war asks on every move) */
export const mapSize = async (map: MapRecord) => {
  const hit = sizes.get(map.image)
  if (hit) return hit
  const bmp = await createImageBitmap(map.image)
  const size = [bmp.width, bmp.height] as const
  sizes.set(map.image, size)
  return size
}
export async function addLayer(map: MapRecord, file: File) {
  const [w, h] = await mapSize(map)
  const layer: MapLayer = { id: newId(), name: file.name.replace(/\.[^.]+$/, '') || 'Layer', image: await fitImage(file, w, h), on: true }
  await db.maps.update(map.id!, { layers: [...(map.layers ?? []), layer] })
}
const changeLayers = (id: number, fn: (layers: MapLayer[]) => MapLayer[]) =>
  db.transaction('rw', db.maps, async () => {
    const m = await db.maps.get(id)
    if (m) await db.maps.update(id, { layers: fn(m.layers ?? []) })
  })
export const toggleLayer = (mapId: number, layerId: string) => changeLayers(mapId, (ls) => ls.map((l) => (l.id === layerId ? { ...l, on: !l.on } : l)))
/** dir -1 = one step up the list (painted later, so further on top), 1 = down. */
export const moveLayer = (mapId: number, layerId: string, dir: -1 | 1) =>
  changeLayers(mapId, (ls) => {
    const i = ls.findIndex((l) => l.id === layerId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ls.length) return ls
    const out = [...ls]
    ;[out[i], out[j]] = [out[j], out[i]]
    return out
  })
export const setAllLayers = (mapId: number, on: boolean) => changeLayers(mapId, (ls) => ls.map((l) => ({ ...l, on })))
export const deleteLayer = (mapId: number, layerId: string) => changeLayers(mapId, (ls) => ls.filter((l) => l.id !== layerId))

/** undefined removes the grid */
export const setGrid = (mapId: number, grid: MapGrid | undefined) => db.maps.update(mapId, { grid })
/** Walls, lights and the fog switches, from the walls window or the battle map */
export const setVision = (mapId: number, change: { walls?: Wall[]; lights?: MapLight[]; fog?: boolean; dark?: boolean }) => db.maps.update(mapId, change)

/** Tokens under the map's switched-on layers: a square counts as covered when its centre pixel is mostly opaque, a token when all its squares are (a big creature
 *  peeking out of the fog is seen). Null without a grid. */
export async function fogCover(map: MapRecord): Promise<FogCover | null> {
  const grid = map.grid
  if (!grid) return null
  const squares = new Set<string>()
  const layers = (map.layers ?? []).filter((l) => l.on)
  if (layers.length) {
    const bmps = await Promise.all(layers.map((l) => createImageBitmap(l.image))) // layers were stretched to the map's size when added
    const [w, h] = [bmps[0].width, bmps[0].height]
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d', { willReadFrequently: true })!
    for (const b of bmps) g.drawImage(b, 0, 0, w, h)
    const alpha = g.getImageData(0, 0, w, h).data
    for (let row = 0; cellBox(grid, { col: 0, row }).y < 1; row++)
      for (let col = 0; cellBox(grid, { col, row }).x < 1; col++) {
        const b = cellBox(grid, { col, row })
        const x = Math.min(w - 1, Math.max(0, Math.floor((b.x + b.w / 2) * w)))
        const y = Math.min(h - 1, Math.max(0, Math.floor((b.y + b.h / 2) * h)))
        if (alpha[(y * w + x) * 4 + 3] >= 128) squares.add(`${col},${row}`)
      }
  }
  return { map: map.id!, hides: (pos, cells) => tokenSquares(pos, cells).every((c) => squares.has(`${c.col},${c.row}`)) }
}

/** What the table sees of a map. The grid goes along even with its lines hidden (it is no secret, and tokens will need it). */
export interface PublicMap {
  /** Which map it is, so tokens placed on another map stay off it */
  id?: number
  name: string
  imageData: string
  grid?: MapGrid
}
/** The map with only its switched-on layers painted over it, and black where the party has not been (`unexplored`: the fog-of-war mask, lib/fog.ts), as ONE picture. Every image is decoded before anything is drawn and the layers that are off never leave the DM's browser,
 *  so a viewer can never get a half-built picture or pull a hidden layer out of the network traffic. */
export async function publicMap(map: MapRecord, unexplored?: string): Promise<PublicMap> {
  const layers = (map.layers ?? []).filter((l) => l.on)
  const grid = { id: map.id, ...(map.grid ? { grid: map.grid } : {}) }
  if (!layers.length && !unexplored) return { name: map.name, imageData: await blobToDataUrl(map.image), ...grid }
  const [base, ...over] = await Promise.all([map.image, ...layers.map((l) => l.image), ...(unexplored ? [await (await fetch(unexplored)).blob()] : [])].map((b) => createImageBitmap(b)))
  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  const g = canvas.getContext('2d')!
  for (const bmp of [base, ...over]) g.drawImage(bmp, 0, 0, base.width, base.height)
  return { name: map.name, imageData: canvas.toDataURL('image/jpeg', 0.85), ...grid }
}
