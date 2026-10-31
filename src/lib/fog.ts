import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db'
import type { Combatant, MapRecord } from '../types'
import { cellBox, tokenCells, tokenSquares, type Cell, type FogCover, type Point } from './grid'
import { fogCover, mapSize, publicMap, type PublicMap } from './maps'
import { blockers, feetToWidths, look, seen, ySquash, type Eye, type Lamp, type View } from './vision'

/**
 * Fog of war that follows the party's sight. Everything is worked out in the DM's browser (like the fog layers): the picture sent to the table has black
 * painted in wherever the party has never been, so an unexplored room never leaves the DM's device. Two small masks go along as the `fog` live part:
 * `dim` (what nobody sees right now: shaded, and enemies there are hidden) and `unexplored` (where the fog animation drifts). The shading is no secret,
 * and moving inside explored rooms only changes those masks, not the big picture.
 *
 * kv `fog:<mapId>` holds what was explored (a PNG mask at a quarter of the picture's size, white = seen) and which doors are open; it syncs like any kv record.
 */
export interface FogState {
  explored?: string
  open?: string[]
}
/** What travels with the map for the table: both are PNG data URLs, black where they apply */
export interface PublicFog {
  dim: string
  unexplored: string
}

const fogKey = (mapId: number) => `fog:${mapId}`
const useFogState = (mapId?: number) =>
  useLiveQuery(async () => (mapId === undefined ? null : (((await db.kv.get(fogKey(mapId)))?.value as FogState | undefined) ?? {})), [mapId])
const changeFog = (mapId: number, fn: (s: FogState) => FogState) =>
  db.transaction('rw', db.kv, async () => {
    const cur = ((await db.kv.get(fogKey(mapId)))?.value as FogState | undefined) ?? {}
    await db.kv.put({ key: fogKey(mapId), value: fn(cur) })
  })
export const toggleDoor = (mapId: number, doorId: string) =>
  changeFog(mapId, (s) => ({ ...s, open: s.open?.includes(doorId) ? s.open.filter((d) => d !== doorId) : [...(s.open ?? []), doorId] }))
export const setAllDoors = (map: MapRecord, open: boolean) =>
  changeFog(map.id!, (s) => ({ ...s, open: open ? (map.walls ?? []).filter((w) => w.kind === 'door').map((w) => w.id) : [] }))
export const resetExplored = (mapId: number) => changeFog(mapId, (s) => ({ ...s, explored: undefined }))
/** Everything counts as explored: no black and no drifting fog left (what nobody sees right now is still shaded, and unseen enemies stay hidden). */
export async function revealAll(map: MapRecord) {
  const [pw, ph] = await mapSize(map)
  const [c, g] = canvas(Math.max(1, Math.round(pw / MASK)), Math.max(1, Math.round(ph / MASK)))
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  const explored = c.toDataURL('image/png')
  await changeFog(map.id!, (s) => ({ ...s, explored }))
}
export const useOpenDoors = (mapId?: number) => new Set(useFogState(mapId)?.open ?? [])

/** Lights a creature can carry, from the 2024 equipment and spell texts as remembered (bright + dim radius): check them against the book. */
export const LIGHT_PRESETS = [
  { key: 'candle', feet: 10 },
  { key: 'torch', feet: 40 },
  { key: 'lamp', feet: 45 },
  { key: 'lantern', feet: 60 },
  { key: 'lightSpell', feet: 40 },
] as const

/** The middle of a token (big creatures cover several squares). */
export const tokenCentre = (map: MapRecord, c: Combatant): Point => {
  const n = tokenCells(c.size)
  const b = cellBox(map.grid!, c.pos!)
  return { x: b.x + (b.w * n) / 2, y: b.y + (b.h * n) / 2 }
}

export interface Sight {
  eyes: View<Eye>[]
  lamps: View<Lamp>[]
}
/** The party's eyes (player characters on this map that are up and not Blinded) and, on a dark map, every light: the map's own and those creatures carry. */
export function sightOf(map: MapRecord, combatants: Combatant[], open: ReadonlySet<string>): Sight {
  const grid = map.grid!
  const walls = blockers(map.walls ?? [], open, 'sight')
  const here = combatants.filter((c) => c.pos?.map === map.id)
  const eyes = here
    .filter((c) => c.kind === 'pc' && c.hp > 0 && !c.conditions.some((x) => x === 'Blinded' || x === 'Unconscious'))
    .map((c) => look({ at: tokenCentre(map, c), range: map.dark ? feetToWidths(grid, c.darkvision ?? 0) : undefined }, walls))
  const lamps = !map.dark
    ? []
    : [
        ...(map.lights ?? []).map((l) => ({ at: l.at, range: feetToWidths(grid, l.feet) })),
        ...here.filter((c) => c.light).map((c) => ({ at: tokenCentre(map, c), range: feetToWidths(grid, c.light!) })),
      ].map((l) => look(l, walls))
  return { eyes, lamps }
}

/** Does the party see a token? It does when it sees the middle of any of its squares. */
export const sees = (map: MapRecord, sight: Sight, pos: Cell, cells: number) =>
  tokenSquares(pos, cells).some((c) => {
    const b = cellBox(map.grid!, c)
    return seen(map.grid!, sight.eyes, sight.lamps, { x: b.x + b.w / 2, y: b.y + b.h / 2 })
  })

const MASK = 4 // masks are a quarter of the picture's size: small to send, and their soft edges look like fog

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d', { willReadFrequently: true })!] as const
}
const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = fail
    img.src = url
  })

/** Paints what the party sees in white. */
function paintSight(g: CanvasRenderingContext2D, w: number, h: number, map: MapRecord, sight: Sight) {
  const squash = ySquash(map.grid!)
  const clip = (poly: Point[]) => {
    g.beginPath()
    poly.forEach((p, i) => (i ? g.lineTo(p.x * w, p.y * h) : g.moveTo(p.x * w, p.y * h)))
    g.closePath()
    g.clip()
  }
  const disc = (at: Point, range: number) => {
    g.beginPath()
    g.ellipse(at.x * w, at.y * h, range * w, (range / squash) * h, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#fff'
  for (const eye of sight.eyes) {
    g.save()
    clip(eye.poly)
    if (eye.source.range === undefined) g.fillRect(0, 0, w, h)
    else {
      disc(eye.source.at, eye.source.range)
      for (const lamp of sight.lamps) {
        g.save()
        clip(lamp.poly)
        disc(lamp.source.at, lamp.source.range)
        g.restore()
      }
    }
    g.restore()
  }
}

/** Black where `white` is not (the masks the table gets). */
function inverse(white: HTMLCanvasElement) {
  const [c, g] = canvas(white.width, white.height)
  g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'destination-out'
  g.drawImage(white, 0, 0)
  return c.toDataURL('image/png')
}

/** The masks for this moment, and what has been explored once what the party sees now is added. */
async function fogMasks(map: MapRecord, sight: Sight, explored?: string) {
  const [pw, ph] = await mapSize(map)
  const w = Math.max(1, Math.round(pw / MASK))
  const h = Math.max(1, Math.round(ph / MASK))
  const [now, g] = canvas(w, h)
  paintSight(g, w, h, map, sight)
  const [ex, e] = canvas(w, h)
  if (explored) e.drawImage(await loadImage(explored), 0, 0, w, h)
  e.drawImage(now, 0, 0)
  // seen or not, nothing in between: re-drawing a soft edge over itself would darken it a little every time, and the mask would never settle
  const px = e.getImageData(0, 0, w, h)
  for (let i = 3; i < px.data.length; i += 4) {
    const on = px.data[i] >= 128
    px.data[i - 3] = px.data[i - 2] = px.data[i - 1] = 255
    px.data[i] = on ? 255 : 0
  }
  e.putImageData(px, 0, 0)
  return { explored: ex.toDataURL('image/png'), dim: inverse(now), unexplored: inverse(ex) }
}

/**
 * A map as the table gets it: the picture (with black where unexplored, unless `reveal` = the DM's own battle map), the fog masks, and which tokens to
 * hide. `write` = this device keeps kv `fog:<id>` up to date with what the party discovers (the DM's live host; other windows only read it).
 */
export function useTableMap(map: MapRecord | null | undefined, combatants: Combatant[] | undefined, { write = false, reveal = false } = {}) {
  const fogOn = !!map?.fog && !!map.grid
  const state = useFogState(fogOn ? map!.id : undefined)
  // what sight depends on, as one string: a fight changes all the time (hit points...), the fog only has to follow tokens, walls, doors and lights
  const sightKey = fogOn
    ? JSON.stringify([map!.id, map!.grid, map!.walls, map!.lights, map!.dark, state?.open, (combatants ?? []).filter((c) => c.pos?.map === map!.id).map((c) => [c.id, c.kind, c.pos, c.size, c.hp > 0, c.conditions, c.darkvision, c.light])])
    : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sight = useMemo(() => (fogOn && state ? sightOf(map!, combatants ?? [], new Set(state.open ?? [])) : null), [sightKey, !!state])
  const [masks, setMasks] = useState<{ mapId: number; explored: string; fog: PublicFog }>()
  useEffect(() => {
    if (!sight || !map || !state) return
    let off = false
    void fogMasks(map, sight, state.explored).then(async (m) => {
      if (off) return
      setMasks({ mapId: map.id!, explored: m.explored, fog: { dim: m.dim, unexplored: m.unexplored } })
      if (write && m.explored !== state.explored) await changeFog(map.id!, (s) => ({ ...s, explored: m.explored }))
    })
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sight, state?.explored, write])
  const fog = fogOn && masks && masks.mapId === map!.id ? masks.fog : undefined

  // the big picture: only re-made when the map or the explored area changes. With fog on it waits for the first masks: the map never goes out uncovered
  const [view, setView] = useState<PublicMap | null>()
  const black = reveal ? undefined : fog?.unexplored
  useEffect(() => {
    if (map === undefined) return
    if (!map) return setView(null)
    if (fogOn && !fog && !reveal) return setView(undefined)
    let off = false
    void publicMap(map, black).then((v) => !off && setView(v))
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, black, fogOn && !fog && !reveal])

  const layers = useLiveQuery(async () => (map ? fogCover(map) : null), [map])
  const cover = useMemo((): FogCover | null => {
    if (!map?.grid || !layers || (fogOn && !sight)) return null
    return { map: map.id!, hides: (pos, cells) => layers.hides(pos, cells) || (!!sight && !sees(map, sight, pos, cells)) }
  }, [map, layers, sight, fogOn])
  return { view, fog, cover, sight }
}
