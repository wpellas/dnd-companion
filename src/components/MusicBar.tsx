import { Music, Pause, Play, SkipForward, Square } from 'lucide-react'
import { useEffect } from 'react'
import { t } from '../lib/i18n'
import { loadLibrary, nextTrack, playPick, setVolume, stopMusic, togglePause, useMusic, useMusicSettings } from '../lib/music'
import { MusicPicker } from './MusicPicker'

/** Shown on every DM tab while music is loaded: pause, skip, volume and a switch to another scene (also in the middle of a fight). */
export function MusicBar() {
  const music = useMusic()
  const { scenes } = useMusicSettings()
  useEffect(() => {
    void loadLibrary()
  }, [])
  const scene = scenes.find((s) => s.id === music.sceneId)
  if (music.track === undefined && !music.error && !scene) return null
  const track = music.tracks.find((x) => x.id === music.track)
  return (
    <div className="music-bar" role="status">
      <span className="music-now">
        <Music /> <strong>{scene?.name ?? t('music.single')}</strong>
        {track && ` · ${track.name}`}
        {music.error && <em className="warn"> {t(`music.err.${music.error}`)}</em>}
      </span>
      <button title={music.playing ? t('music.pause') : t('music.resume')} aria-label={music.playing ? t('music.pause') : t('music.resume')} onClick={() => void togglePause()}>
        {music.playing ? <Pause /> : <Play />}
      </button>
      <button title={t('music.next')} aria-label={t('music.next')} onClick={() => void nextTrack()}>
        <SkipForward />
      </button>
      <button title={t('music.stop')} aria-label={t('music.stop')} onClick={stopMusic}>
        <Square />
      </button>
      <input type="range" min={0} max={1} step={0.05} value={music.volume} aria-label={t('music.volume')} title={t('music.volume')} onChange={(e) => setVolume(Number(e.target.value))} />
      <MusicPicker placeholder={t('music.switch')} onChange={(pick) => pick && void playPick(pick, scenes)} />
    </div>
  )
}
