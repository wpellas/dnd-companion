import { useLiveQuery } from 'dexie-react-hooks'
import { BrickWall, DoorClosed, DoorOpen, Grid3x3, X } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db'
import { askConfirm } from '../lib/ask'
import { moveFeet, mutateCombat, placeToken } from '../lib/combat'
import { movementLeft } from '../lib/conditionRules'
import { LIGHT_PRESETS, resetExplored, revealAll, setAllDoors, toggleDoor, tokenCentre, useOpenDoors, useTableMap } from '../lib/fog'
import { cellAt, squaresBetween, tokenCells, type Cell } from '../lib/grid'
import { t } from '../lib/i18n'
import { framePoint } from '../lib/mapPointer'
import { setGrid, setVision, useMapShown } from '../lib/maps'
import { isParty } from '../lib/sides'
import { blockers, crosses } from '../lib/vision'
import type { Combatant } from '../types'
import { LayerList } from './LayerList'
import { FogOverlay, MapFrame, MapToken } from './MapFrame'
import { Portrait } from './Portrait'
import { CheckField } from './Section'
import { WallsWindow } from './WallsWindow'

/**
 * The map being shown, with the fight's tokens, for the DM to place and move (Combat page). Pick a creature in the tray and click a square, or drag a token.
 * The DM sees the whole map; what the players do not see is shaded (fog of war) and enemies they cannot see are faded (`useTableMap`, the same rules as
 * the upload). Moves go through `mutateCombat`, so Undo takes them back; a move of the creature whose turn it is also counts as its movement. A drag through
 * a wall or a closed door is refused, a pick-and-click placement is not (teleports, forced movement).
 */
export function BattleMap({ combatants, activeId, imageFor }: { combatants: Combatant[]; activeId?: string; imageFor: (c: Combatant) => Blob | undefined }) {
  const shown = useMapShown()
  const map = useLiveQuery(async () => (shown ? ((await db.maps.get(shown.mapId)) ?? null) : null), [shown?.mapId])
  const table = useTableMap(map, combatants, { reveal: true })
  const open = useOpenDoors(map?.id)
  const [selected, setSelected] = useState<string>()
  const [editWalls, setEditWalls] = useState(false)
  // the token being dragged: `offset` = the square it was grabbed by, counted from its top-left one; `at` = where it would land (null = off the map: dropping cancels)
  const [drag, setDrag] = useState<{ id: string; offset: Cell; at: Cell | null }>()
  if (!map || !table.view) return null
  const grid = map.grid
  if (!grid) return <p className="muted small"><Grid3x3 /> {t('maps.battleNoGrid', { name: map.name })}</p>

  const creatures = combatants.filter((c) => c.kind !== 'lair')
  const here = (c: Combatant) => c.pos?.map === map.id
  const chosen = creatures.find((c) => c.id === selected)
  const walls = map.walls ?? []
  const doors = walls.filter((w) => w.kind === 'door')
  const stops = blockers(walls, open, 'move')
  const blocked = (c: Combatant, at: Cell) => crosses(tokenCentre(map, c), tokenCentre(map, { ...c, pos: { map: map.id!, ...at } }), stops)
  // the creature whose turn it is walks: the squares become feet of its movement (the movement bar shows what is left)
  const walks = (c: Combatant) => c.id === activeId && here(c)
  const feetTo = (c: Combatant, at: Cell) => squaresBetween(c.pos!, at) * grid.feet
  const place = (c: Combatant, at: Cell | null) =>
    void mutateCombat((s) => {
      const live = s.combatants.find((x) => x.id === c.id)
      if (at && live && walks(live)) moveFeet(s, live, feetTo(live, at))
      placeToken(s, c.id, at && { map: map.id!, ...at })
    }, t(at ? 'maps.undoMove' : 'maps.undoRemove', { name: c.name }))
  const placed = creatures.filter(here)
  // one undo step takes them all back
  const clearMap = () =>
    void mutateCombat((s) => {
      for (const c of s.combatants) if (c.pos?.map === map.id) placeToken(s, c.id, null)
    }, t('maps.undoClear'))
  const setLight = (c: Combatant, feet: number) =>
    void mutateCombat((s) => {
      const live = s.combatants.find((x) => x.id === c.id)
      if (live) live.light = feet || undefined
    }, t('fog.undoLight', { name: c.name }))
  const landing = (e: React.PointerEvent, offset: Cell) => {
    const p = framePoint(e, e.currentTarget)
    if (p.x < 0 || p.y < 0 || p.x > 1 || p.y > 1) return null
    const cell = cellAt(grid, p)
    return { col: cell.col - offset.col, row: cell.row - offset.row }
  }

  return (
    <section className="card battle-map">
      <h3><Grid3x3 /> {t('maps.battleTitle', { name: map.name })}</h3>
      <p className="muted small">{t(map.fog ? 'fog.hint' : 'maps.battleHint')}</p>
      {/* what changes mid-fight without going to the Maps tab: grid lines, fog, revealing rooms (layers), the walls */}
      <div className="row gap wrap battle-tools">
        <div className="battle-switches">
          <CheckField label={t('maps.gridShow')} checked={grid.show} onChange={(show) => void setGrid(map.id!, { ...grid, show })} />
          <CheckField label={t('fog.on')} checked={!!map.fog} onChange={(fog) => void setVision(map.id!, { fog })} />
          {map.fog && <CheckField label={t('fog.dark')} checked={!!map.dark} onChange={(dark) => void setVision(map.id!, { dark })} />}
          <div className="row gap wrap">
            <button className="tiny-button" onClick={() => setEditWalls(true)}><BrickWall /> {t('walls.button')}</button>
            {placed.length > 0 && (
              <button className="tiny-button" onClick={async () => (await askConfirm(t('maps.clearConfirm', { n: placed.length }), t('maps.clear'))) && clearMap()}>
                <X /> {t('maps.clear')}
              </button>
            )}
            {doors.length > 0 && (
              <>
                <button className="tiny-button" disabled={doors.every((d) => !open.has(d.id))} onClick={async () => (await askConfirm(t('fog.closeAllConfirm', { n: doors.length }), t('fog.closeAll'))) && void setAllDoors(map, false)}>
                  <DoorClosed /> {t('fog.closeAll')}
                </button>
                <button className="tiny-button" disabled={doors.every((d) => open.has(d.id))} onClick={async () => (await askConfirm(t('fog.openAllConfirm', { n: doors.length }), t('fog.openAll'))) && void setAllDoors(map, true)}>
                  <DoorOpen /> {t('fog.openAll')}
                </button>
              </>
            )}
            {map.fog && (
              <button className="tiny-button" onClick={async () => (await askConfirm(t('fog.resetConfirm'), t('fog.reset'))) && void resetExplored(map.id!)}>
                {t('fog.reset')}
              </button>
            )}
            {map.fog && (
              <button className="tiny-button" onClick={async () => (await askConfirm(t('fog.revealConfirm'), t('fog.reveal'))) && void revealAll(map)}>
                {t('fog.reveal')}
              </button>
            )}
          </div>
        </div>
        {!!map.layers?.length && <LayerList map={map} />}
      </div>
      <div className="row gap wrap token-tray">
        {creatures.map((c) => (
          <button key={c.id} className={`token-chip ${here(c) ? 'placed' : ''}`} data-side={isParty(c) ? 'party' : 'enemy'} aria-pressed={selected === c.id} onClick={() => setSelected(selected === c.id ? undefined : c.id)}>
            <Portrait name={c.name} image={imageFor(c)} size={26} /> {c.name}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="row gap wrap token-chosen" role="status">
          <span>{t('maps.battlePlace', { name: chosen.name })}</span>
          {map.dark && (
            <label className="inline-field">
              {t('fog.light')}
              <select value={chosen.light ?? 0} onChange={(e) => setLight(chosen, Number(e.target.value))}>
                <option value={0}>{t('fog.light.none')}</option>
                {LIGHT_PRESETS.map((l) => (
                  <option key={l.key} value={l.feet}>{t(`fog.light.${l.key}`)} ({l.feet} ft)</option>
                ))}
              </select>
            </label>
          )}
          {here(chosen) && <button className="tiny-button danger" onClick={() => { place(chosen, null); setSelected(undefined) }}><X /> {t('maps.tokenRemove')}</button>}
        </div>
      )}
      <MapFrame
        src={table.view.imageData}
        alt={map.name}
        grid={grid}
        lines
        maxHeight="75vh"
        onPick={chosen ? (p) => { place(chosen, cellAt(grid, p)); setSelected(undefined) } : undefined}
      >
        {table.fog && <FogOverlay fog={table.fog} dm />}
        <svg className="wall-lines" viewBox="0 0 1 1" preserveAspectRatio="none">
          {walls.map((w) =>
            w.kind !== 'door' ? (
              <line key={w.id} data-kind={w.kind} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} />
            ) : (
              <g key={w.id} className="door" data-open={open.has(w.id) || undefined} onClick={(e) => { e.stopPropagation(); void toggleDoor(map.id!, w.id) }}>
                <title>{t('fog.door')}</title>
                <line className="hit" x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} />
                <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} />
              </g>
            ),
          )}
        </svg>
        {creatures.filter(here).map((c) => {
          const dragged = drag?.id === c.id
          const wall = dragged && !!drag.at && blocked(c, drag.at)
          const feet = dragged && drag.at && walks(c) ? feetTo(c, drag.at) : 0
          const left = movementLeft(c)
          return (
            <MapToken
              key={c.id}
              name={c.name}
              image={imageFor(c)}
              grid={grid}
              at={dragged && drag.at ? drag.at : c.pos!}
              cells={tokenCells(c.size)}
              side={isParty(c) ? 'party' : 'enemy'}
              active={c.id === activeId}
              down={c.hp === 0}
              selected={selected === c.id}
              dragging={dragged}
              hidden={!isParty(c) && !!table.cover?.hides(c.pos!, tokenCells(c.size))}
              badge={wall ? t('fog.blocked') : feet ? t('maps.tokenFeet', { feet }) : undefined}
              over={wall || (left !== undefined && feet > left)}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                const grabbed = cellAt(grid, framePoint(e, e.currentTarget))
                setDrag({ id: c.id, offset: { col: grabbed.col - c.pos!.col, row: grabbed.row - c.pos!.row }, at: c.pos! })
              }}
              onPointerMove={(e) => dragged && setDrag({ ...drag, at: landing(e, drag.offset) })}
              onPointerUp={(e) => {
                if (!dragged) return
                const at = landing(e, drag.offset)
                setDrag(undefined)
                if (!at || blocked(c, at)) return
                if (at.col !== c.pos!.col || at.row !== c.pos!.row) place(c, at)
                else setSelected(selected === c.id ? undefined : c.id) // a click without moving picks it (then click a square, or take it off)
              }}
              onPointerCancel={() => setDrag(undefined)}
              onClick={(e) => e.stopPropagation()} // the frame's click would place the selected token here
            />
          )
        })}
      </MapFrame>
      {editWalls && <WallsWindow map={map} onClose={() => setEditWalls(false)} />}
    </section>
  )
}
