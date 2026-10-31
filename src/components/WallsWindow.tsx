import { DoorClosed, Eraser, Eye, Lamp, PanelTop, Square, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useBlobUrl, usePromise } from '../hooks'
import { askConfirm } from '../lib/ask'
import type { Point } from '../lib/grid'
import { newId } from '../lib/id'
import { t } from '../lib/i18n'
import { framePoint } from '../lib/mapPointer'
import { mapSize, setVision } from '../lib/maps'
import { blockers, feetToWidths, visibilityPolygon, ySquash } from '../lib/vision'
import type { MapLight, MapRecord, Wall } from '../types'
import { MapFrame } from './MapFrame'
import { NumberField } from './NumberField'
import { CheckField } from './Section'
import { Window } from './Window'

type Tool = Wall['kind'] | 'light' | 'erase' | 'look'
const TOOLS: { tool: Tool; icon: React.ReactNode }[] = [
  { tool: 'wall', icon: <Square /> },
  { tool: 'door', icon: <DoorClosed /> },
  { tool: 'window', icon: <PanelTop /> },
  { tool: 'light', icon: <Lamp /> },
  { tool: 'erase', icon: <Eraser /> },
  { tool: 'look', icon: <Eye /> },
]
interface Draft {
  walls: Wall[]
  lights: MapLight[]
}

/**
 * Draws a map's walls, doors, windows and standing lights, and holds the fog switches. Points are clicked one after another (each one ends a segment and starts
 * the next); a point near an existing wall end lands on it, so walls join up and no gap lets sight through. Nothing is saved until Save.
 */
export function WallsWindow({ map, onClose }: { map: MapRecord; onClose: () => void }) {
  const url = useBlobUrl(map.image)
  const size = usePromise(() => mapSize(map), [map.image]).data
  const [draft, setDraft] = useState<Draft>({ walls: map.walls ?? [], lights: map.lights ?? [] })
  const [history, setHistory] = useState<{ draft: Draft; last: Point | null }[]>([])
  const [tool, setTool] = useState<Tool>('wall')
  const [last, setLast] = useState<Point | null>(null)
  const [hover, setHover] = useState<Point | null>(null)
  const [eye, setEye] = useState<Point | null>(null)
  const [snapGrid, setSnapGrid] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [lightFeet, setLightFeet] = useState(40)
  const [fog, setFog] = useState(!!map.fog)
  const [dark, setDark] = useState(!!map.dark)
  const grid = map.grid
  const dirty = history.length > 0 || fog !== !!map.fog || dark !== !!map.dark

  // distances in picture widths, so "near" means the same on a wide and a tall map
  const aspect = size ? size[1] / size[0] : 1
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, (a.y - b.y) * aspect)
  const NEAR = 0.012 / zoom
  const snap = (p: Point): Point => {
    const ends = draft.walls.flatMap((w) => [w.a, w.b])
    const end = ends.reduce<Point | null>((best, e) => (dist(e, p) < NEAR && (!best || dist(e, p) < dist(best, p)) ? e : best), null)
    if (end) return end
    if (snapGrid && grid) {
      const along = (v: number, offset: number, size: number) => (offset % size) + Math.round((v - (offset % size)) / size) * size
      return { x: along(p.x, grid.x, grid.w), y: along(p.y, grid.y, grid.h) }
    }
    return p
  }
  const change = (next: Draft, nextLast: Point | null) => {
    setHistory([...history, { draft, last }])
    setDraft(next)
    setLast(nextLast)
  }
  const undo = () => {
    const prev = history.at(-1)
    if (!prev) return
    setHistory(history.slice(0, -1))
    setDraft(prev.draft)
    setLast(prev.last)
  }
  // how far a point is from a segment, for the eraser
  const toSegment = (p: Point, w: Wall) => {
    const dx = w.b.x - w.a.x
    const dy = (w.b.y - w.a.y) * aspect
    const len = dx * dx + dy * dy
    const u = len ? Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * aspect * dy) / len)) : 0
    return Math.hypot(p.x - (w.a.x + u * dx), (p.y - w.a.y) * aspect - u * dy)
  }

  const pick = (raw: Point) => {
    if (tool === 'look') return setEye(raw)
    if (tool === 'light') return change({ ...draft, lights: [...draft.lights, { id: newId(), at: raw, feet: lightFeet }] }, null)
    if (tool === 'erase') {
      const light = draft.lights.find((l) => dist(l.at, raw) < NEAR * 1.5)
      if (light) return change({ ...draft, lights: draft.lights.filter((l) => l !== light) }, null)
      const wall = draft.walls.reduce<Wall | null>((best, w) => (toSegment(raw, w) < NEAR && (!best || toSegment(raw, w) < toSegment(raw, best)) ? w : best), null)
      if (wall) change({ ...draft, walls: draft.walls.filter((w) => w !== wall) }, null)
      return
    }
    const p = snap(raw)
    if (!last) return setLast(p)
    if (dist(p, last) < NEAR) return setLast(null) // the last point again: the line ends
    change({ ...draft, walls: [...draft.walls, { id: newId(), a: last, b: p, kind: tool }] }, p)
  }

  const save = async () => {
    await setVision(map.id!, { walls: draft.walls, lights: draft.lights, fog, dark })
    onClose()
  }
  const close = async () => {
    if (!dirty || (await askConfirm(t('walls.discard'), t('walls.discardYes')))) onClose()
  }
  const count = (kind: Wall['kind']) => draft.walls.filter((w) => w.kind === kind).length
  const sight = eye ? visibilityPolygon(eye, blockers(draft.walls, new Set(), 'sight')) : null
  const squash = grid ? ySquash(grid) : 1

  return (
    <Window
      large
      title={t('walls.title', { name: map.name })}
      onClose={() => void close()}
      actions={
        <>
          <button onClick={() => void close()}>{t('common.cancel')}</button>
          <button className="primary" onClick={() => void save()}>{t('common.save')}</button>
        </>
      }
    >
      <p className="muted small">{t('walls.hint')}</p>
      {!grid && <p className="muted small">{t('walls.needGrid')}</p>}
      <div className="row gap wrap grid-tools">
        <CheckField label={t('fog.on')} checked={fog} onChange={setFog} />
        <CheckField label={t('fog.dark')} checked={dark} onChange={setDark} />
      </div>
      <div className="row gap wrap grid-tools" role="toolbar">
        {TOOLS.map(({ tool: k, icon }) => (
          <button key={k} className={tool === k ? 'primary' : ''} aria-pressed={tool === k} disabled={k === 'light' && !grid} onClick={() => { setTool(k); setLast(null) }}>
            {icon} {t(`walls.tool.${k}`)}
          </button>
        ))}
      </div>
      <div className="row gap wrap grid-tools">
        <button className="tiny-button" disabled={!last} onClick={() => setLast(null)}>{t('walls.endLine')}</button>
        <button className="tiny-button" disabled={!history.length} onClick={undo}><Undo2 /> {t('walls.undo')}</button>
        <button
          className="tiny-button danger"
          disabled={!draft.walls.length && !draft.lights.length}
          onClick={async () => (await askConfirm(t('walls.clearConfirm'), t('walls.clear'))) && change({ walls: [], lights: [] }, null)}
        >
          {t('walls.clear')}
        </button>
        {grid && <CheckField label={t('walls.snap')} checked={snapGrid} onChange={setSnapGrid} />}
        <label className="inline-field">
          {t('walls.zoom')}
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {[1, 1.5, 2, 3].map((z) => <option key={z} value={z}>{z * 100}%</option>)}
          </select>
        </label>
        {tool === 'light' && <NumberField integer min={5} label={t('walls.lightFeet')} value={lightFeet} onChange={(n) => setLightFeet(Math.max(5, Math.round(n)))} />}
        <span className="muted small">{t('walls.counts', { walls: count('wall'), doors: count('door'), windows: count('window'), lights: draft.lights.length })}</span>
      </div>
      {url && (
        <div className="walls-scroll" onContextMenu={(e) => { e.preventDefault(); setLast(null) }}>
          <div style={{ width: `${zoom * 100}%` }} onPointerMove={(e) => {
            const img = e.currentTarget.querySelector('.map-frame > img')
            if (img) setHover(framePoint(e, img))
          }} onPointerLeave={() => setHover(null)}>
            <MapFrame src={url} alt={map.name} grid={grid} lines={!!grid} maxHeight={zoom === 1 ? '62vh' : '1000vh'} onPick={pick}>
              <svg className="wall-lines editing" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
                {sight && <polygon className="sight" points={sight.map((p) => `${p.x},${p.y}`).join(' ')} />}
                {grid && draft.lights.map((l) => {
                  const r = feetToWidths(grid, l.feet)
                  return <ellipse key={l.id} className="light" cx={l.at.x} cy={l.at.y} rx={r} ry={r / squash} />
                })}
                {draft.walls.map((w) => <line key={w.id} data-kind={w.kind} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} />)}
                {last && hover && tool !== 'look' && <line className="rubber" x1={last.x} y1={last.y} x2={snap(hover).x} y2={snap(hover).y} />}
              </svg>
              {draft.walls.flatMap((w) => [w.a, w.b]).map((p, i) => <span key={i} className="wall-end" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />)}
              {draft.lights.map((l) => <span key={l.id} className="light-dot" style={{ left: `${l.at.x * 100}%`, top: `${l.at.y * 100}%` }} />)}
              {last && <span className="grid-mark" style={{ left: `${last.x * 100}%`, top: `${last.y * 100}%` }} />}
              {eye && tool === 'look' && <span className="eye-dot" style={{ left: `${eye.x * 100}%`, top: `${eye.y * 100}%` }} />}
            </MapFrame>
          </div>
        </div>
      )}
    </Window>
  )
}
