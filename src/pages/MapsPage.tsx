import { ChevronDown, ChevronUp, Folder, GripVertical, Move, X } from 'lucide-react'
import { useState } from 'react'
import { CheckField } from '../components/Section'
import { FolderMoveWindow } from '../components/FolderMoveWindow'
import { db } from '../db'
import { useBlobUrl } from '../hooks'
import { askConfirm, askText } from '../lib/ask'
import { t } from '../lib/i18n'
import {
  addLayer, addMap, allFolders, createFolder, deleteFolder, deleteLayer, deleteMap, setAllLayers, folderName, inFolder, joinPath, moveLayer, moveMap, parentPath, renameFolder, renameMap,
  showMap, stopShowingMap, toggleLayer, useFolders, useMapShown, useMaps, type PictureKind,
} from '../lib/maps'
import type { MapRecord } from '../types'

/** The DM's maps (kind 'map') or story pictures (kind 'image'), sorted into folders: upload, rename, move, delete, and show one to the players (or stop). */
export function MapsPage({ kind = 'map' }: { kind?: PictureKind }) {
  const maps = useMaps(kind)
  const shown = useMapShown()
  const explicit = useFolders(kind)
  const [path, setPath] = useState('')
  const [moving, setMoving] = useState<MapRecord | null>(null)
  const [drag, setDrag] = useState<MapRecord | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const folders = allFolders(explicit, maps)
  const subfolders = folders.filter((f) => parentPath(f) === path)
  const here = maps.filter((m) => (m.folder ?? '') === path)
  const crumbs = path ? path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/')) : []
  // a picture dragged onto a folder or a crumb moves there; `data-drop` marks a valid target while dragging, `data-over` the one under the pointer
  const drop = (target: string) => ({
    'data-drop': drag && (drag.folder ?? '') !== target ? '' : undefined,
    'data-over': over === target ? '' : undefined,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(target)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const id = Number(e.dataTransfer.getData('text/plain'))
      setOver(null)
      setDrag(null)
      if (id) void moveMap(id, target)
    },
  })
  const newFolder = async () => {
    const name = (await askText({ title: t('maps.folderName'), value: '', confirm: t('common.save') }))?.replace(/\//g, ' ').trim()
    if (name) await createFolder(kind, joinPath(path, name))
  }
  return (
    <div className={`page ${drag ? 'dragging' : ''}`}>
      <div className="toolbar">
        <h2>{t(`${kind}s.title`)}</h2>
        <button onClick={() => void newFolder()}><Folder /> {t('maps.newFolder')}</button>
        <label className="file-button primary">
          {t(`${kind}s.upload`)}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              for (const f of files) await addMap(f, kind, path).catch(() => alert(t('maps.failed')))
            }}
          />
        </label>
      </div>
      <p className="muted">{t(`${kind}s.intro`)}</p>
      {kind === 'map' && <p className="muted small">{t('maps.layersHint')}</p>}
      {folders.length > 0 && (
        <div className="crumbs" role="navigation" aria-label="folders">
          <button className={path ? '' : 'here'} onClick={() => setPath('')} {...drop('')}>
            {t('maps.root')}
          </button>
          {crumbs.map((c) => (
            <span key={c} className="row gap">
              <span className="muted">›</span>
              <button className={c === path ? 'here' : ''} onClick={() => setPath(c)} {...drop(c)}>
                {folderName(c)}
              </button>
            </span>
          ))}
        </div>
      )}
      {maps.length === 0 && folders.length === 0 && <p className="muted">{t(`${kind}s.empty`)}</p>}
      {drag ? (
        <p className="drag-banner" role="status">
          <Move /> {t('maps.dragging', { name: drag.name })}
        </p>
      ) : (
        maps.length > 0 && <p className="muted small"><GripVertical /> {t('maps.dragHint')}</p>
      )}
      {path && subfolders.length === 0 && here.length === 0 && <p className="muted">{t('maps.folderEmpty')}</p>}
      <div className="map-grid">
        {subfolders.map((f) => (
          <FolderCard key={f} kind={kind} path={f} count={maps.filter((m) => inFolder(f, m.folder)).length} onOpen={() => setPath(f)} drop={drop(f)} />
        ))}
        {here.map((m) => (
          <MapCard
            key={m.id}
            map={m}
            showing={shown?.mapId === m.id}
            onMove={() => setMoving(m)}
            dragged={drag?.id === m.id}
            onDragState={(on) => {
              setDrag(on ? m : null)
              if (!on) setOver(null)
            }}
          />
        ))}
      </div>
      {moving && <FolderMoveWindow name={moving.name} folder={moving.folder ?? ''} folders={folders} onMove={(f) => moveMap(moving.id!, f)} onClose={() => setMoving(null)} />}
    </div>
  )
}

function FolderCard({ kind, path, count, onOpen, drop }: { kind: PictureKind; path: string; count: number; onOpen: () => void; drop: object }) {
  const name = folderName(path)
  return (
    <div className="card folder-card" {...drop}>
      <span className="drop-label" aria-hidden>{t('maps.dropHere')}</span>
      <button className="folder-open" onClick={onOpen}>
        <span className="folder-icon" aria-hidden><Folder /></span>
        <strong>{name}</strong>
        <span className="muted small">{t('maps.folderItems', { count })}</span>
      </button>
      <div className="row gap">
        <button
          onClick={async () => {
            const to = (await askText({ title: t('maps.folderName'), value: name, confirm: t('common.save') }))?.replace(/\//g, ' ').trim()
            if (to && to !== name) void renameFolder(kind, path, to)
          }}
        >
          {t('maps.rename')}
        </button>
        <button className="danger" onClick={async () => (await askConfirm(t('maps.folderDeleteConfirm', { name }), t('common.delete'))) && void deleteFolder(kind, path)}>
          {t('maps.delete')}
        </button>
      </div>
    </div>
  )
}

function LayerImg({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob)
  return url ? <img src={url} alt="" /> : null
}

/** Layers of a map: each switch decides whether the players see it; what is switched on is stacked over the map in the preview, just as the table gets it.
 *  One compact row per layer (a thumbnail says which is which), folded away under a summary so a map with many fog layers does not stretch its card. */
function LayerList({ map }: { map: MapRecord }) {
  const layers = map.layers ?? []
  const on = layers.filter((l) => l.on).length
  const add = (
    <label className="file-button">
      {t('maps.layerAdd')}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          for (const f of files) await addLayer((await db.maps.get(map.id!)) ?? map, f).catch(() => alert(t('maps.failed')))
        }}
      />
    </label>
  )
  if (!layers.length) return <div className="map-layers">{add}</div>
  return (
    <details className="map-layers">
      <summary>{t('maps.layersSummary', { on, total: layers.length })}</summary>
      <div className="row gap wrap layer-bulk">
        <button className="tiny-button" disabled={on === layers.length} onClick={() => void setAllLayers(map.id!, true)}>{t('maps.layersAllOn')}</button>
        <button className="tiny-button" disabled={on === 0} onClick={() => void setAllLayers(map.id!, false)}>{t('maps.layersAllOff')}</button>
      </div>
      {layers.map((l, i) => (
        <div className="layer-row" key={l.id}>
          <div className="layer-thumb"><LayerImg blob={l.image} /></div>
          <CheckField label={l.name} checked={l.on} onChange={() => void toggleLayer(map.id!, l.id)} />
          <button className="tiny-button" disabled={i === 0} title={t('maps.layerUp')} aria-label={t('maps.layerUp')} onClick={() => void moveLayer(map.id!, l.id, -1)}><ChevronUp /></button>
          <button className="tiny-button" disabled={i === layers.length - 1} title={t('maps.layerDown')} aria-label={t('maps.layerDown')} onClick={() => void moveLayer(map.id!, l.id, 1)}><ChevronDown /></button>
          <button
            className="tiny-button danger"
            title={t('maps.layerDelete')}
            aria-label={t('maps.layerDelete')}
            onClick={async () => (await askConfirm(t('maps.layerDeleteConfirm', { name: l.name }), t('common.delete'))) && void deleteLayer(map.id!, l.id)}
          >
            <X />
          </button>
        </div>
      ))}
      {add}
    </details>
  )
}

function MapCard({ map, showing, onMove, dragged, onDragState }: { map: MapRecord; showing: boolean; onMove: () => void; dragged: boolean; onDragState: (on: boolean) => void }) {
  const url = useBlobUrl(map.image)
  return (
    <div
      className={`card map-card ${showing ? 'showing' : ''} ${dragged ? 'is-dragged' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(map.id))
        e.dataTransfer.effectAllowed = 'move'
        // the picture itself follows the pointer, not a snapshot of the whole card with its buttons
        const img = e.currentTarget.querySelector('img')
        if (img) e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2)
        onDragState(true)
      }}
      onDragEnd={() => onDragState(false)}
    >
      <div className="map-stack">
        {url && <img src={url} alt={map.name} draggable={false} />}
        {(map.layers ?? []).filter((l) => l.on).map((l) => (
          <LayerImg key={l.id} blob={l.image} />
        ))}
        <span className="grip" aria-hidden title={t('maps.dragHint')}><GripVertical /></span>
      </div>
      <strong>{map.name}</strong>
      {showing && <span className="chip">{t('maps.showing')}</span>}
      <div className="row gap wrap">
        {showing ? (
          <button onClick={() => void stopShowingMap()}>{t('maps.hide')}</button>
        ) : (
          <button className="primary" onClick={() => void showMap(map.id!)}>
            {t('maps.show')}
          </button>
        )}
        <button onClick={onMove}>{t('maps.move')}</button>
        <button
          onClick={async () => {
            const name = await askText({ title: t('maps.renamePrompt'), value: map.name, confirm: t('common.save') })
            if (name) void renameMap(map.id!, name)
          }}
        >
          {t('maps.rename')}
        </button>
        <button className="danger" onClick={async () => (await askConfirm(t('maps.deleteConfirm', { name: map.name }), t('common.delete'))) && void deleteMap(map.id!)}>
          {t('maps.delete')}
        </button>
      </div>
      {!map.kind && <LayerList map={map} />}
    </div>
  )
}
