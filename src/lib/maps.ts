import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { blobToDataUrl, fitImage, shrinkImage } from './image'
import { newId } from './id'
import type { MapLayer, MapRecord } from '../types'

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
export const addMap = async (file: File, kind: PictureKind = 'map') =>
  db.maps.add({ name: file.name.replace(/\.[^.]+$/, '') || (kind === 'map' ? 'Map' : 'Image'), ...(kind === 'image' ? { kind } : {}), image: await shrinkImage(file, 1800) })
export const renameMap = (id: number, name: string) => db.maps.update(id, { name })

export async function showMap(mapId: number) {
  await db.kv.delete('spotlight') // one thing at a time
  await db.kv.put({ key: KEY, value: { mapId } satisfies MapShown })
}
export const stopShowingMap = () => db.kv.delete(KEY)
export async function deleteMap(id: number) {
  const shown = (await db.kv.get(KEY))?.value as MapShown | undefined
  if (shown?.mapId === id) await stopShowingMap()
  await db.maps.delete(id)
}

/** Layers: the DM adds same-sized overlay pictures (fog of war...) and switches each on or off. They are stored on the map, so the switches are remembered when the map is hidden and shown again. */
const mapSize = async (map: MapRecord) => {
  const bmp = await createImageBitmap(map.image)
  return [bmp.width, bmp.height] as const
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
export const deleteLayer = (mapId: number, layerId: string) => changeLayers(mapId, (ls) => ls.filter((l) => l.id !== layerId))

/** What the table sees of a map. */
export interface PublicMap {
  name: string
  imageData: string
}
/** The map with only its switched-on layers painted over it, as ONE picture. Every image is decoded before anything is drawn and the layers that are off never leave the DM's browser,
 *  so a viewer can never get a half-built picture or pull a hidden layer out of the network traffic. */
export async function publicMap(map: MapRecord): Promise<PublicMap> {
  const layers = (map.layers ?? []).filter((l) => l.on)
  if (!layers.length) return { name: map.name, imageData: await blobToDataUrl(map.image) }
  const [base, ...over] = await Promise.all([map.image, ...layers.map((l) => l.image)].map((b) => createImageBitmap(b)))
  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  const g = canvas.getContext('2d')!
  for (const bmp of [base, ...over]) g.drawImage(bmp, 0, 0, base.width, base.height)
  return { name: map.name, imageData: canvas.toDataURL('image/jpeg', 0.85) }
}
