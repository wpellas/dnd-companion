import { useBlobUrl } from '../hooks'
import { t } from '../lib/i18n'
import { addMap, deleteMap, renameMap, showMap, stopShowingMap, useMapShown, useMaps } from '../lib/maps'
import type { MapRecord } from '../types'

/** The DM's maps and handouts: upload, rename, delete, and show one to the players (or stop). */
export function MapsPage() {
  const maps = useMaps()
  const shown = useMapShown()
  return (
    <div className="page">
      <div className="toolbar">
        <h2>{t('maps.title')}</h2>
        <label className="file-button primary">
          {t('maps.upload')}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              for (const f of files) await addMap(f).catch(() => alert(t('maps.failed')))
            }}
          />
        </label>
      </div>
      <p className="muted">{t('maps.intro')}</p>
      <p className="muted small">{t('maps.fogSoon')}</p>
      {maps.length === 0 && <p className="muted">{t('maps.empty')}</p>}
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
          onClick={() => {
            const name = prompt(t('maps.renamePrompt'), map.name)?.trim()
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
