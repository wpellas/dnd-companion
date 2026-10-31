import type { MapGrid } from '../types'

/**
 * The square grid over a map. Everything is in fractions of the picture (0-1 across and down), so the grid, the fog layers (stretched to the map's size) and
 * later the tokens stay lined up whatever size the picture is drawn at. Pure: no React, no database.
 */
export interface Point {
  x: number
  y: number
}
/** Column 0 / row 0 is the first square touching the picture's left / top edge (it can be cut off by the edge). */
export interface Cell {
  col: number
  row: number
}

// at most 500 squares across: a slip of the mouse (two clicks on top of each other) must not draw thousands of lines
const MIN = 0.002
// a rounding error (0.25 % 0.05 = 0.04999...) would put the first line a whole square in: snap that to 0
const mod = (v: number, m: number) => {
  const r = ((v % m) + m) % m
  return m - r < 1e-9 ? 0 : r
}

/** The grid through two points where grid lines cross, with `across` / `down` squares between them. The grid need not be drawn on the whole map:
 *  any two crossings work and the grid carries on over the rest. Null when the points are too close together. */
export function gridFromPoints(a: Point, b: Point, across: number, down: number): Pick<MapGrid, 'x' | 'y' | 'w' | 'h'> | null {
  const w = Math.abs(b.x - a.x) / Math.max(1, across)
  const h = Math.abs(b.y - a.y) / Math.max(1, down)
  if (!(w >= MIN && h >= MIN)) return null
  return { x: mod(a.x, w), y: mod(a.y, h), w, h }
}

/** Where the first (cut-off) square starts: at or left of / above the edge. */
const start = (offset: number, size: number) => {
  const m = mod(offset, size)
  return m > 1e-9 ? m - size : 0
}

/** The grid lines inside the picture. */
export function gridLines(g: MapGrid) {
  const along = (offset: number, size: number) => {
    const out: number[] = []
    const first = mod(offset, size)
    for (let i = 0; first + i * size < 1 - 1e-9 && size >= MIN; i++) out.push(first + i * size)
    return out
  }
  return { xs: along(g.x, g.w), ys: along(g.y, g.h) }
}

/** The square a point of the picture falls in. */
export const cellAt = (g: MapGrid, p: Point): Cell => ({ col: Math.floor((p.x - start(g.x, g.w)) / g.w), row: Math.floor((p.y - start(g.y, g.h)) / g.h) })

/** How many squares across a creature's token covers (2024 sizes; Tiny to Medium take one). */
export const tokenCells = (size?: string) => ({ large: 2, huge: 3, gargantuan: 4 })[size?.toLowerCase() as 'large'] ?? 1

/** Squares moved between two token positions. shortcut: a diagonal step counts like any other square (5 ft; from memory of the 2024 grid rules), check the book. */
export const squaresBetween = (a: Cell, b: Cell) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))

/** Which tokens of the map being shown the players must not see (under a fog layer, or out of the party's sight); worked out in the DM's browser (lib/fog.ts). */
export interface FogCover {
  map: number
  hides: (pos: Cell, cells: number) => boolean
}
/** Every square a token covers. */
export const tokenSquares = (pos: Cell, cells: number): Cell[] =>
  Array.from({ length: cells * cells }, (_, i) => ({ col: pos.col + (i % cells), row: pos.row + Math.floor(i / cells) }))

/** A square's box on the picture (a token sits in it). */
export const cellBox = (g: MapGrid, c: Cell) => ({ x: start(g.x, g.w) + c.col * g.w, y: start(g.y, g.h) + c.row * g.h, w: g.w, h: g.h })
