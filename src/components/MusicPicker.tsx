import { t, tn } from '../lib/i18n'
import { useMusic, useMusicSettings } from '../lib/music'
import { Combobox } from './Combobox'

/** A searchable list of the scenes and every track in the library. The value is `scene:<id>` or `track:<id>`. */
export function MusicPicker({ value, onChange, placeholder, clearLabel }: { value?: string; onChange: (value: string | undefined) => void; placeholder: string; clearLabel?: string }) {
  const music = useMusic()
  const { scenes } = useMusicSettings()
  const options = [
    ...scenes.map((s) => ({ value: `scene:${s.id}`, label: s.name, group: t('music.pickScenes'), hint: tn('music.sceneHint', s.tracks.length) })),
    ...music.tracks.map((x) => ({ value: `track:${x.id}`, label: x.name, group: t('music.pickTracks'), hint: x.uploader ?? undefined })),
  ]
  return <Combobox className="music-pick" options={options} value={value} onChange={onChange} placeholder={placeholder} clearLabel={clearLabel} />
}
