import { useBlobUrl } from '../hooks'
import { askText } from '../lib/ask'
import { t } from '../lib/i18n'
import { addMap, deleteMap, renameMap, showMap, stopShowingMap, useMapShown, useMaps, type PictureKind } from '../lib/maps'
import type { MapRecord } from '../types'

/** The DM's maps (kind 'map') or story pictures (kind 'image'): upload, rename, delete, and show one to the players (or stop). */
export function MapsPage({ kind = 'map' }: { kind?: PictureKind }) {
  const maps = useMaps(kind)
  const shown = useMapShown()
  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t(`${kind}s.title`)}</h2>
        <label className="file-button primary">
          {t(`${kind}s.upload`)}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              for (const f of files) await addMap(f, kind).catch(() => alert(t('maps.failed')))
            }}
          />
        </label>
      </div>
      <p className="muted">{t(`${kind}s.intro`)}</p>
      {kind === 'map' && <p className="muted small">{t('maps.fogSoon')}</p>}
      {maps.length === 0 && <p className="muted">{t(`${kind}s.empty`)}</p>}
      <div className="map-grid">
        {maps.map((m) => (
          <MapCard key={m.id} map={m} showing={shown?.mapId === m.id} />
        ))}
      </div>
    </div>
  )
}

function MapCard({ map, showing }: { map: MapRecord; showing: boolean }) {
  const url = useBlobUrl(map.image)
  return (
    <div className={`card map-card ${showing ? 'showing' : ''}`}>
      {url && <img src={url} alt={map.name} />}
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
        <button
          onClick={async () => {
            const name = await askText({ title: t('maps.renamePrompt'), value: map.name, confirm: t('common.save') })
            if (name) void renameMap(map.id!, name)
          }}
        >
          {t('maps.rename')}
        </button>
        <button className="danger" onClick={() => confirm(t('maps.deleteConfirm', { name: map.name })) && void deleteMap(map.id!)}>
          {t('maps.delete')}
        </button>
      </div>
    </div>
  )
}
