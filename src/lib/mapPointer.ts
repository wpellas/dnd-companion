import type { Point } from './grid'

/** Where a pointer is on the map picture of the MapFrame that `el` sits in, in fractions of the picture (outside it: below 0 or above 1). */
export function framePoint(e: { clientX: number; clientY: number }, el: Element): Point {
  const r = el.closest('.map-frame')!.querySelector(':scope > img')!.getBoundingClientRect()
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}
