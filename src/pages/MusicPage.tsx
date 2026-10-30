import { Folder, GripVertical, Move, Pencil, Play, X } from 'lucide-react'
import { useState } from 'react'
import { Combobox } from '../components/Combobox'
import { CheckField } from '../components/Section'
import { ApiError } from '../lib/api'
import { askConfirm, askText } from '../lib/ask'
import { folderName, inFolder, joinPath, parentPath } from '../lib/maps'
import { newId } from '../lib/id'
import { t } from '../lib/i18n'
import { FolderMoveWindow } from '../components/FolderMoveWindow'
import { createMusicFolder, deleteMusicFolder, moveTrackToFolder, renameMusicFolder, deleteTrack, loadLibrary, playScene, playTrack, renameTrack, saveMusicSettings, sceneTracks, uploadTrack, useMusic, useMusicSettings, type Scene, type TrackInfo } from '../lib/music'

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
const SHOWN = 100

/** The music: the shared library (everyone's uploads) and this campaign's scenes (Battle, Boss, Town...) made of tracks from it. */
export function MusicPage() {
  const music = useMusic()
  const settings = useMusicSettings()
  const { scenes } = settings
  const [filter, setFilter] = useState('')
  const [uploading, setUploading] = useState('')
  const [path, setPath] = useState('')
  const [moving, setMoving] = useState<TrackInfo | null>(null)
  const [drag, setDrag] = useState<TrackInfo | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const save = (next: Scene[], combatSceneId = settings.combatSceneId) => void saveMusicSettings({ ...settings, scenes: next, combatSceneId })
  const patch = (id: string, p: Partial<Scene>) => save(scenes.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const upload = async (files: File[]) => {
    for (const [i, f] of files.entries()) {
      setUploading(t('music.uploading', { i: i + 1, n: files.length, name: f.name }))
      try {
        await uploadTrack(f)
      } catch (e) {
        const why = e instanceof ApiError ? Object.values(e.fields)[0] ?? e.message : String(e)
        alert(t('music.uploadFail', { name: f.name, why }))
      }
    }
    setUploading('')
    await loadLibrary()
  }

  const needle = filter.trim().toLowerCase()
  const matches = music.tracks.filter((x) => !needle || x.name.toLowerCase().includes(needle) || (x.uploader ?? '').toLowerCase().includes(needle))
  const folderOf = (id: number) => settings.trackFolders?.[id] ?? ''
  const folders = [
    ...new Set(
      [...(settings.folders ?? []), ...Object.values(settings.trackFolders ?? {})].flatMap((p) => p.split('/').filter(Boolean).map((_, i, parts) => parts.slice(0, i + 1).join('/'))),
    ),
  ].sort((a, b) => a.localeCompare(b))
  // a search looks through every folder; otherwise the list shows this folder's folders and tracks
  const subfolders = needle ? [] : folders.filter((f) => parentPath(f) === path)
  const shownTracks = needle ? matches : matches.filter((x) => folderOf(x.id) === path)
  const crumbs = path ? path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/')) : []
  // a track dragged onto a folder or a crumb moves there; `data-drop` marks a valid target while dragging, `data-over` the one under the pointer
  const drop = (target: string) => ({
    'data-drop': drag && folderOf(drag.id) !== target ? '' : undefined,
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
      if (id) void moveTrackToFolder(id, target)
    },
  })
  const newFolder = async () => {
    const name = (await askText({ title: t('maps.folderName'), value: '', confirm: t('common.save') }))?.replace(/\//g, ' ').trim()
    if (name) await createMusicFolder(joinPath(path, name))
  }
  const total = music.tracks.reduce((sum, x) => sum + x.size, 0)

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('music.title')}</h2>
      </div>
      <p className="muted">{t('music.intro')}</p>

      <div className={`card music-library ${drag ? 'dragging' : ''}`}>
        <div className="music-folder">
          <span>
            {music.library === 'ready' && t('music.count', { n: music.tracks.length, size: megabytes(total) })}
            {music.library === 'loading' && t('music.loading')}
            {music.library === 'error' && <span className="warn">{t('music.err.library')}</span>}
          </span>
          <div className="row gap wrap">
            {music.library === 'error' && <button onClick={() => void loadLibrary()}>{t('music.retry')}</button>}
            <button onClick={() => void newFolder()}><Folder /> {t('maps.newFolder')}</button>
            <label className={`file-button primary ${uploading ? 'disabled' : ''}`}>
              {t('music.upload')}
              <input
                type="file"
                accept="audio/*,.mp3,.ogg,.oga,.opus,.m4a,.aac,.wav,.flac,.webm"
                multiple
                disabled={!!uploading}
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])]
                  e.target.value = ''
                  if (files.length) void upload(files)
                }}
              />
            </label>
          </div>
        </div>
        {uploading && <p className="muted small">{uploading}</p>}
        {music.tracks.length > 8 && <input className="inv-filter" type="search" value={filter} placeholder={t('music.search')} onChange={(e) => setFilter(e.target.value)} />}
        {music.library === 'ready' && music.tracks.length === 0 && <p className="muted">{t('music.libraryEmpty')}</p>}
        {folders.length > 0 && !needle && (
          <div className="crumbs" role="navigation" aria-label="folders">
            <button className={path ? '' : 'here'} onClick={() => setPath('')} {...drop('')}>
              {t('music.root')}
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
        {drag ? (
          <p className="drag-banner" role="status">
            <Move /> {t('music.dragging', { name: drag.name })}
          </p>
        ) : (
          music.tracks.length > 0 && folders.length > 0 && <p className="muted small"><GripVertical /> {t('music.dragHint')}</p>
        )}
        {path && !needle && subfolders.length === 0 && shownTracks.length === 0 && <p className="muted">{t('maps.folderEmpty')}</p>}
        <div className="music-tracks">
          {subfolders.map((f) => (
            <FolderRow key={f} path={f} count={music.tracks.filter((x) => inFolder(f, folderOf(x.id) || undefined)).length} onOpen={() => setPath(f)} drop={drop(f)} />
          ))}
          {shownTracks.slice(0, SHOWN).map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onMove={() => setMoving(track)}
              onDragState={(on) => {
                setDrag(on ? track : null)
                if (!on) setOver(null)
              }}
            />
          ))}
          {shownTracks.length > SHOWN && <p className="muted small">{t('music.more', { n: shownTracks.length - SHOWN })}</p>}
        </div>
        {moving && <FolderMoveWindow name={moving.name} folder={folderOf(moving.id)} folders={folders} root={t('music.root')} onMove={(f) => moveTrackToFolder(moving.id, f)} onClose={() => setMoving(null)} />}
      </div>

      <div className="toolbar">
        <h3>{t('music.scenes')}</h3>
        <button
          className="primary"
          onClick={async () => {
            const name = await askText({ title: t('music.scenePrompt'), value: t('music.newScene'), confirm: t('common.add') })
            if (name) save([...scenes, { id: newId(), name, tracks: [] }])
          }}
        >
          {t('music.addScene')}
        </button>
      </div>
      {scenes.length === 0 && <p className="muted">{t('music.noScenes')}</p>}
      <div className="music-scenes">
        {scenes.map((scene) => {
          const ids = sceneTracks(scene)
          return (
            <div key={scene.id} className="card item-card">
              <div className="inv-line">
                <strong className="grow">{scene.name}</strong>
                <CheckField label={t('music.shuffle')} checked={!!scene.shuffle} onChange={(on) => patch(scene.id, { shuffle: on || undefined })} />
                <CheckField label={t('music.combatScene')} title={t('music.combatSceneTitle')} checked={settings.combatSceneId === scene.id} onChange={(on) => void saveMusicSettings({ ...settings, scenes, combatSceneId: on ? scene.id : undefined, combatTrackId: on ? undefined : settings.combatTrackId })} />
                <button className="primary" disabled={!ids.length} onClick={() => void playScene(scene.id, scenes)}>
                  {t('music.play')}
                </button>
                <button
                  onClick={async () => {
                    const name = await askText({ title: t('music.scenePrompt'), value: scene.name, confirm: t('common.save') })
                    if (name) patch(scene.id, { name })
                  }}
                >
                  {t('music.rename')}
                </button>
                <button
                  className="danger"
                  onClick={async () => (await askConfirm(t('music.deleteConfirm', { name: scene.name }), t('common.delete'))) && save(scenes.filter((s) => s.id !== scene.id), settings.combatSceneId === scene.id ? undefined : settings.combatSceneId)}
                >
                  {t('music.delete')}
                </button>
              </div>
              {ids.length === 0 && <p className="muted">{t('music.noTracks')}</p>}
              {ids.map((id) => {
                const track = music.tracks.find((x) => x.id === id)
                const gone = music.library === 'ready' && !track
                return (
                  <div key={id} className="inv-line">
                    <span className={`grow ${gone ? 'warn' : ''}`}>{gone ? t('music.missing') : (track?.name ?? '…')}</span>
                    <button title={t('music.preview')} aria-label={t('music.preview')} disabled={!track} onClick={() => void playTrack(id)}>
                      <Play />
                    </button>
                    <button className="danger" title={t('music.removeTrack')} aria-label={t('music.removeTrack')} onClick={() => patch(scene.id, { tracks: ids.filter((x) => x !== id) })}>
                      <X />
                    </button>
                  </div>
                )
              })}
              {music.library === 'ready' && (
                <Combobox
                  className="target-select"
                  placeholder={t('music.addTrack')}
                  options={music.tracks.filter((x) => !ids.includes(x.id)).map((x) => ({ value: String(x.id), label: x.name, group: x.uploader ?? t('music.noUploader'), hint: megabytes(x.size) }))}
                  onChange={(id) => id && patch(scene.id, { tracks: [...ids, Number(id)] })}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FolderRow({ path, count, onOpen, drop }: { path: string; count: number; onOpen: () => void; drop: object }) {
  const name = folderName(path)
  return (
    <div className="inv-line folder-row" {...drop}>
      <span className="drop-label" aria-hidden>{t('maps.dropHere')}</span>
      <button className="folder-link grow" onClick={onOpen}>
        <span aria-hidden><Folder /></span> <strong>{name}</strong> <span className="muted small">{t('maps.folderItems', { count })}</span>
      </button>
      <button
        onClick={async () => {
          const to = (await askText({ title: t('maps.folderName'), value: name, confirm: t('common.save') }))?.replace(/\//g, ' ').trim()
          if (to && to !== name) void renameMusicFolder(path, to)
        }}
      >
        {t('maps.rename')}
      </button>
      <button className="danger" onClick={async () => (await askConfirm(t('maps.folderDeleteConfirm', { name }), t('common.delete'))) && void deleteMusicFolder(path)}>
        {t('maps.delete')}
      </button>
    </div>
  )
}

function TrackRow({ track, onMove, onDragState }: { track: TrackInfo; onMove: () => void; onDragState: (on: boolean) => void }) {
  return (
    <div
      className="inv-line track-row"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(track.id))
        e.dataTransfer.effectAllowed = 'move'
        onDragState(true)
      }}
      onDragEnd={() => onDragState(false)}
    >
      <span className="grip-inline" aria-hidden><GripVertical /></span>
      <span className="grow">
        <strong>{track.name}</strong>
        <span className="muted small">
          {' '}
          · {track.uploader ?? t('music.noUploader')} · {megabytes(track.size)}
        </span>
      </span>
      <button title={t('music.preview')} aria-label={t('music.preview')} onClick={() => void playTrack(track.id)}>
        <Play />
      </button>
      <button title={t('maps.move')} aria-label={t('maps.move')} onClick={onMove}>
        <Folder />
      </button>
      {track.can_edit && (
        <>
          <button
            title={t('music.rename')}
            aria-label={t('music.rename')}
            onClick={async () => {
              const name = await askText({ title: t('music.trackPrompt'), value: track.name, confirm: t('common.save') })
              if (name) void renameTrack(track.id, name)
            }}
          >
            <Pencil />
          </button>
          <button className="danger" title={t('music.deleteTrack')} aria-label={t('music.deleteTrack')} onClick={async () => (await askConfirm(t('music.deleteTrackConfirm', { name: track.name }), t('common.delete'))) && void deleteTrack(track.id)}>
            <X />
          </button>
        </>
      )}
    </div>
  )
}
