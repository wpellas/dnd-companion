import type { MapGrid, Wall } from '../types'
import type { Point } from './grid'

/**
 * Line of sight on a map (pure: no React, no database). Everything is in fractions of the picture like the grid: straight lines stay straight under that
 * stretch, so walls, rays and polygons can be worked out there. Only distances (darkvision, light) need real proportions: `ySquash` turns a picture-height
 * fraction into picture widths, using the grid's squares (they are square on the map).
 *
 * 2024 rules this follows: creatures see all around them (no facing); in a dark place a creature sees what is within its darkvision or lit by a light.
 * Bright and dim light both count as seeing (dim light's Disadvantage on Perception is the DM's call).
 */
export interface Segment {
  a: Point
  b: Point
}
/** Someone looking: `range` in picture widths (none = no limit, the map is lit) */
export interface Eye {
  at: Point
  range?: number
}
/** A light: where it is and how far it reaches, in picture widths */
export interface Lamp {
  at: Point
  range: number
}

/** What stops sight / movement. A door blocks both while closed; a window lets sight through but not feet. */
export function blockers(walls: Wall[], open: ReadonlySet<string>, purpose: 'sight' | 'move'): Segment[] {
  return walls.filter((w) => (w.kind === 'door' ? !open.has(w.id) : w.kind === 'wall' || purpose === 'move')).map(({ a, b }) => ({ a, b }))
}

/** How far along the ray o + t·(dx, dy) it meets segment s (t >= 0), or null. */
function hit(o: Point, dx: number, dy: number, s: Segment): number | null {
  const ex = s.b.x - s.a.x
  const ey = s.b.y - s.a.y
  const den = dx * ey - dy * ex
  if (Math.abs(den) < 1e-15) return null
  const qx = s.a.x - o.x
  const qy = s.a.y - o.y
  const t = (qx * ey - qy * ex) / den
  const u = (qx * dy - qy * dx) / den
  return t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 ? t : null
}

const EDGES: Segment[] = [
  { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
  { a: { x: 1, y: 0 }, b: { x: 1, y: 1 } },
  { a: { x: 1, y: 1 }, b: { x: 0, y: 1 } },
  { a: { x: 0, y: 1 }, b: { x: 0, y: 0 } },
]

/** Everything visible from `o` (inside the picture) as a polygon: a ray towards every wall end (and just past it on both sides), stopped by the nearest wall. */
export function visibilityPolygon(o: Point, walls: Segment[]): Point[] {
  const segs = [...walls, ...EDGES]
  const angles: number[] = []
  for (const s of segs)
    for (const p of [s.a, s.b]) {
      const a = Math.atan2(p.y - o.y, p.x - o.x)
      angles.push(a - 1e-5, a, a + 1e-5)
    }
  angles.sort((a, b) => a - b)
  const out: Point[] = []
  for (const a of angles) {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let best = Infinity
    for (const s of segs) {
      const t = hit(o, dx, dy, s)
      if (t !== null && t < best) best = t
    }
    if (best < Infinity) out.push({ x: o.x + dx * best, y: o.y + dy * best })
  }
  return out
}

export function insidePolygon(p: Point, poly: Point[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Does the straight path p -> q cross any of the segments? (Touching an end counts, so a token cannot slip through where two walls meet.) */
export function crosses(p: Point, q: Point, segs: Segment[]) {
  const side = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return segs.some((s) => {
    const d1 = side(s.a, s.b, p)
    const d2 = side(s.a, s.b, q)
    const d3 = side(p, q, s.a)
    const d4 = side(p, q, s.b)
    return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0)
  })
}

/** Feet -> picture widths, from the grid (`feet` per square of `grid.w` widths). */
export const feetToWidths = (grid: MapGrid, feet: number) => (feet / grid.feet) * grid.w
/** Picture heights -> picture widths (squares are square on the map). */
export const ySquash = (grid: MapGrid) => grid.w / grid.h
const distance = (grid: MapGrid, a: Point, b: Point) => Math.hypot(a.x - b.x, (a.y - b.y) * ySquash(grid))

/** An eye or light with its line of sight worked out. */
export interface View<T extends Eye | Lamp = Eye> {
  source: T
  poly: Point[]
}
export const look = <T extends Eye | Lamp>(source: T, walls: Segment[]): View<T> => ({ source, poly: visibilityPolygon(source.at, walls) })

const reaches = (grid: MapGrid, v: View<Eye | Lamp>, p: Point) => insidePolygon(p, v.poly) && (v.source.range === undefined || distance(grid, v.source.at, p) <= v.source.range)

/** Can the party see point p? Seen = in someone's line of sight and, where the eye's sight is limited (dark map), within its range or lit by a light that reaches p. */
export function seen(grid: MapGrid, eyes: View<Eye>[], lamps: View<Lamp>[], p: Point) {
  return eyes.some((e) => insidePolygon(p, e.poly) && (e.source.range === undefined || reaches(grid, e, p) || lamps.some((l) => reaches(grid, l, p))))
}
