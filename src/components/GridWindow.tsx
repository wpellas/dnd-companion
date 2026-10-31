import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useBlobUrl, usePromise } from '../hooks'
import { gridFromPoints, type Point } from '../lib/grid'
import { t } from '../lib/i18n'
import { mapSize, setGrid } from '../lib/maps'
import type { MapGrid, MapRecord } from '../types'
import { MapFrame } from './MapFrame'
import { NumberField } from './NumberField'
import { CheckField } from './Section'
import { Window } from './Window'

type Shape = Pick<MapGrid, 'x' | 'y' | 'w' | 'h'>

/**
 * Lays a grid over a map: click two places where grid lines cross (as far apart as possible, so a small miss is spread over many squares), say how many
 * squares lie between them, then nudge it by a pixel until it sits on the drawn lines. The map's grid can be drawn only in parts (rooms, corridors): the grid
 * carries on over the whole picture anyway.
 */
export function GridWindow({ map, onClose }: { map: MapRecord; onClose: () => void }) {
  const url = useBlobUrl(map.image)
  const size = usePromise(() => mapSize(map), [map.image]).data
  const [shape, setShape] = useState<Shape | null>(map.grid ?? null)
  const [points, setPoints] = useState<Point[]>([])
  const [picking, setPicking] = useState(!map.grid)
  const [across, setAcross] = useState(1)
  const [down, setDown] = useState(1)
  const [feet, setFeet] = useState(map.grid?.feet ?? 5)
  const [show, setShow] = useState(map.grid?.show ?? false)

  const fit = (a: Point, b: Point, nx: number, ny: number) => {
    const g = gridFromPoints(a, b, nx, ny)
    if (g) setShape(g)
  }
  const pick = (p: Point) => {
    const next = points.length === 1 ? [points[0], p] : [p]
    setPoints(next)
    if (next.length === 2) {
      setPicking(false)
      fit(next[0], next[1], across, down)
    }
  }
  const count = (set: (n: number) => void, which: 'across' | 'down') => (n: number) => {
    const v = Math.max(1, Math.round(n))
    set(v)
    if (points.length === 2) fit(points[0], points[1], which === 'across' ? v : across, which === 'down' ? v : down)
  }
  // nudges are in the picture's own pixels: a move shifts the lines by one pixel, a size step makes each square a tenth of a pixel bigger or smaller
  const px = size ? { x: 1 / size[0], y: 1 / size[1] } : null
  const nudge = (dx: number, dy: number, grow = 0) =>
    shape && px && setShape({ x: shape.x + dx * px.x, y: shape.y + dy * px.y, w: shape.w + grow * px.x, h: shape.h + grow * px.y })
  const grid: MapGrid | undefined = shape ? { ...shape, feet, show } : undefined
  const tune = (label: string, icon: React.ReactNode, fn: () => void) => (
    <button className="tiny-button" title={label} aria-label={label} disabled={!shape || !px} onClick={fn}>{icon}</button>
  )
  const save = async () => {
    if (grid) await setGrid(map.id!, grid)
    onClose()
  }
  const remove = async () => {
    await setGrid(map.id!, undefined)
    onClose()
  }

  return (
    <Window
      large
      title={t('maps.gridTitle', { name: map.name })}
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          {map.grid && <button className="danger" onClick={() => void remove()}>{t('maps.gridRemove')}</button>}
          <button className="primary" disabled={!grid} onClick={() => void save()}>{t('common.save')}</button>
        </>
      }
    >
      <p className="muted small">{t('maps.gridHint')}</p>
      <div className="row gap wrap grid-tools">
        <button className={picking ? 'primary' : ''} onClick={() => { setPoints([]); setPicking(true) }}>
          <Crosshair /> {t('maps.gridPick')}
        </button>
        {picking && <span role="status">{t(points.length === 1 ? 'maps.gridPickB' : 'maps.gridPickA')}</span>}
      </div>
      <div className="field-grid">
        <NumberField integer min={1} label={t('maps.gridAcross')} value={across} onChange={count(setAcross, 'across')} />
        <NumberField integer min={1} label={t('maps.gridDown')} value={down} onChange={count(setDown, 'down')} />
        <NumberField integer min={1} label={t('maps.gridFeet')} value={feet} onChange={(n) => setFeet(Math.max(1, Math.round(n)))} />
      </div>
      <div className="row gap wrap grid-tools">
        <span className="muted">{t('maps.gridTune')}</span>
        {tune(t('maps.gridLeft'), <ArrowLeft />, () => nudge(-1, 0))}
        {tune(t('maps.gridRight'), <ArrowRight />, () => nudge(1, 0))}
        {tune(t('maps.gridUp'), <ArrowUp />, () => nudge(0, -1))}
        {tune(t('maps.gridDown2'), <ArrowDown />, () => nudge(0, 1))}
        {tune(t('maps.gridSmaller'), <Minus />, () => nudge(0, 0, -0.1))}
        {tune(t('maps.gridLarger'), <Plus />, () => nudge(0, 0, 0.1))}
        {shape && size && <span className="muted small">{t('maps.gridSquare', { w: (shape.w * size[0]).toFixed(1), h: (shape.h * size[1]).toFixed(1) })}</span>}
      </div>
      <CheckField label={t('maps.gridShow')} checked={show} onChange={setShow} />
      {url && (
        <div className="grid-calibrate">
          <MapFrame src={url} alt={map.name} grid={grid} lines maxHeight="65vh" onPick={picking ? pick : undefined}>
            {points.map((p, i) => <span key={i} className="grid-mark" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />)}
          </MapFrame>
        </div>
      )}
    </Window>
  )
}
