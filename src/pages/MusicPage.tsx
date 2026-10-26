import { useState } from 'react'
import { Combobox } from '../components/Combobox'
import { CheckField } from '../components/Section'
import { ApiError } from '../lib/api'
import { newId } from '../lib/id'
import { t } from '../lib/i18n'
import { deleteTrack, loadLibrary, playScene, playTrack, renameTrack, saveMusicSettings, sceneTracks, uploadTrack, useMusic, useMusicSettings, type Scene, type TrackInfo } from '../lib/music'

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`
const SHOWN = 100

/** The music: the shared library (everyone's uploads) and this campaign's scenes (Battle, Boss, Town...) made of tracks from it. */
export function MusicPage() {
  const music = useMusic()
  const settings = useMusicSettings()
  const { scenes } = settings
  const [filter, setFilter] = useState('')
  const [uploading, setUploading] = useState('')
  const save = (next: Scene[], combatSceneId = settings.combatSceneId) => void saveMusicSettings({ scenes: next, combatSceneId })
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
  const total = music.tracks.reduce((sum, x) => sum + x.size, 0)

  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('music.title')}</h2>
      </div>
      <p className="muted">{t('music.intro')}</p>

      <div className="card music-library">
        <div className="music-folder">
          <span>
            {music.library === 'ready' && t('music.count', { n: music.tracks.length, size: megabytes(total) })}
            {music.library === 'loading' && t('music.loading')}
            {music.library === 'error' && <span className="warn">{t('music.err.library')}</span>}
          </span>
          <div className="row gap wrap">
            {music.library === 'error' && <button onClick={() => void loadLibrary()}>{t('music.retry')}</button>}
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
        <div className="music-tracks">
          {matches.slice(0, SHOWN).map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
          {matches.length > SHOWN && <p className="muted small">{t('music.more', { n: matches.length - SHOWN })}</p>}
        </div>
      </div>

      <div className="toolbar">
        <h3>{t('music.scenes')}</h3>
        <button
          className="primary"
          onClick={() => {
            const name = prompt(t('music.scenePrompt'), t('music.newScene'))?.trim()
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
                <CheckField label={t('music.combatScene')} title={t('music.combatSceneTitle')} checked={settings.combatSceneId === scene.id} onChange={(on) => save(scenes, on ? scene.id : undefined)} />
                <button className="primary" disabled={!ids.length} onClick={() => void playScene(scene.id, scenes)}>
                  {t('music.play')}
                </button>
                <button
                  onClick={() => {
                    const name = prompt(t('music.scenePrompt'), scene.name)?.trim()
                    if (name) patch(scene.id, { name })
                  }}
                >
                  {t('music.rename')}
                </button>
                <button
                  className="danger"
                  onClick={() => confirm(t('music.deleteConfirm', { name: scene.name })) && save(scenes.filter((s) => s.id !== scene.id), settings.combatSceneId === scene.id ? undefined : settings.combatSceneId)}
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
                      ▶
                    </button>
                    <button className="danger" title={t('music.removeTrack')} aria-label={t('music.removeTrack')} onClick={() => patch(scene.id, { tracks: ids.filter((x) => x !== id) })}>
                      ✕
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

function TrackRow({ track }: { track: TrackInfo }) {
  return (
    <div className="inv-line">
      <span className="grow">
        <strong>{track.name}</strong>
        <span className="muted small">
          {' '}
          · {track.uploader ?? t('music.noUploader')} · {megabytes(track.size)}
        </span>
      </span>
      <button title={t('music.preview')} aria-label={t('music.preview')} onClick={() => void playTrack(track.id)}>
        ▶
      </button>
      {track.can_edit && (
        <>
          <button
            title={t('music.rename')}
            aria-label={t('music.rename')}
            onClick={() => {
              const name = prompt(t('music.trackPrompt'), track.name)?.trim()
              if (name) void renameTrack(track.id, name)
            }}
          >
            ✎
          </button>
          <button className="danger" title={t('music.deleteTrack')} aria-label={t('music.deleteTrack')} onClick={() => confirm(t('music.deleteTrackConfirm', { name: track.name })) && void deleteTrack(track.id)}>
            ✕
          </button>
        </>
      )}
    </div>
  )
}
