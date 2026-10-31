import { useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { useBlobUrl } from '../hooks'
import { cellBox, gridLines, type Cell, type Point } from '../lib/grid'
import { t } from '../lib/i18n'
import type { PublicFog } from '../lib/fog'
import type { MapGrid } from '../types'

/**
 * A map picture with its grid on top, both stretched over the same box (the box takes the picture's proportions), so anything placed in fractions of the
 * picture lines up at any size. `children` are drawn over it too, positioned in percent (calibration marks, tokens).
 */
export function MapFrame({ src, alt, grid, lines, maxHeight, onPick, children }: {
  src: string
  alt: string
  grid?: MapGrid
  /** Draw the grid lines */
  lines?: boolean
  /** The tallest the picture may be, a CSS length ('65vh', '100vh - 18px') */
  maxHeight: string
  /** A click on the picture, in fractions of it */
  onPick?: (p: Point) => void
  children?: ReactNode
}) {
  const [ratio, setRatio] = useState<number>()
  const img = useRef<HTMLImageElement>(null)
  return (
    <div
      className={`map-frame ${onPick ? 'picking' : ''}`}
      style={ratio ? { aspectRatio: String(ratio), width: `min(100%, calc((${maxHeight}) * ${ratio}))` } : undefined}
      onClick={
        onPick &&
        ((e) => {
          const r = img.current!.getBoundingClientRect()
          onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
        })
      }
    >
      <img ref={img} src={src} alt={alt} draggable={false} onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
      {grid && lines && <GridLines grid={grid} />}
      {children}
    </div>
  )
}

/** Fog of war over a map: shade where nobody looks right now, and drifting fog over the never-explored black (the black itself is in the picture). */
export function FogOverlay({ fog, dm }: { fog: PublicFog; dm?: boolean }) {
  const mask = `url(${fog.unexplored})`
  return (
    <>
      <img className="fog-dim" src={fog.dim} alt="" draggable={false} />
      {dm ? <img className="fog-unexplored" src={fog.unexplored} alt="" draggable={false} /> : <div className="fog-drift" style={{ maskImage: mask, WebkitMaskImage: mask }} aria-hidden />}
    </>
  )
}

function GridLines({ grid }: { grid: MapGrid }) {
  const { xs, ys } = gridLines(grid)
  return (
    <svg className="grid-lines" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      {xs.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={1} />)}
      {ys.map((y) => <line key={`y${y}`} x1={0} x2={1} y1={y} y2={y} />)}
    </svg>
  )
}

/** "Goblin 3" -> "G3": tells numbered monsters apart on a token without a picture. */
const initials = (name: string) => `${name.trim().charAt(0).toUpperCase() || '?'}${name.match(/\s(\d+)$/)?.[1] ?? ''}`

/** A creature's round token on the grid, covering `cells` squares across from its top-left square. Extra props (pointer handlers) go on its box. */
export function MapToken({ name, src, image, grid, at, cells = 1, side, active, down, selected, dragging, hidden, badge, over, ...rest }: {
  name: string
  src?: string
  image?: Blob
  grid: MapGrid
  at: Cell
  cells?: number
  side: 'party' | 'enemy'
  active?: boolean
  down?: boolean
  selected?: boolean
  dragging?: boolean
  /** DM only: under fog, so the players do not see it */
  hidden?: boolean
  /** A short note on the token (the distance while it is dragged); `over` = more than the creature may move */
  badge?: string
  over?: boolean
} & Omit<HTMLAttributes<HTMLDivElement>, 'hidden'>) {
  const blobUrl = useBlobUrl(image)
  const url = src ?? blobUrl
  const b = cellBox(grid, at)
  return (
    <div
      className="map-token"
      data-side={side}
      data-active={active || undefined}
      data-down={down || undefined}
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-hidden={hidden || undefined}
      title={hidden ? t('maps.tokenHidden', { name }) : name}
      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * cells * 100}%`, height: `${b.h * cells * 100}%` }}
      {...rest}
    >
      <span>{url ? <img src={url} alt={name} draggable={false} /> : initials(name)}</span>
      {badge && <em className={over ? 'over' : ''}>{badge}</em>}
    </div>
  )
}
