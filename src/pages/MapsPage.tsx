import { CheckField } from '../components/Section'
import { db } from '../db'
import { useBlobUrl } from '../hooks'
import { askConfirm, askText } from '../lib/ask'
import { t } from '../lib/i18n'
import { addLayer, addMap, deleteLayer, deleteMap, moveLayer, renameMap, showMap, stopShowingMap, toggleLayer, useMapShown, useMaps, type PictureKind } from '../lib/maps'
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
      {kind === 'map' && <p className="muted small">{t('maps.layersHint')}</p>}
      {maps.length === 0 && <p className="muted">{t(`${kind}s.empty`)}</p>}
      <div className="map-grid">
        {maps.map((m) => (
          <MapCard key={m.id} map={m} showing={shown?.mapId === m.id} />
        ))}
      </div>
    </div>
  )
}

function LayerImg({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob)
  return url ? <img src={url} alt="" /> : null
}

/** Layers of a map: each switch decides whether the players see it; what is switched on is stacked over the map in the preview, just as the table gets it. */
function LayerList({ map }: { map: MapRecord }) {
  const layers = map.layers ?? []
  return (
    <div className="map-layers">
      {layers.map((l, i) => (
        <div className="row gap" key={l.id}>
          <CheckField label={l.name} checked={l.on} onChange={() => void toggleLayer(map.id!, l.id)} />
          <button disabled={i === 0} title={t('maps.layerUp')} aria-label={t('maps.layerUp')} onClick={() => void moveLayer(map.id!, l.id, -1)}>
            ▲
          </button>
          <button disabled={i === layers.length - 1} title={t('maps.layerDown')} aria-label={t('maps.layerDown')} onClick={() => void moveLayer(map.id!, l.id, 1)}>
            ▼
          </button>
          <button className="danger" onClick={async () => (await askConfirm(t('maps.layerDeleteConfirm', { name: l.name }), t('common.delete'))) && void deleteLayer(map.id!, l.id)}>
            {t('maps.layerDelete')}
          </button>
        </div>
      ))}
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
    </div>
  )
}

function MapCard({ map, showing }: { map: MapRecord; showing: boolean }) {
  const url = useBlobUrl(map.image)
  return (
    <div className={`card map-card ${showing ? 'showing' : ''}`}>
      <div className="map-stack">
        {url && <img src={url} alt={map.name} />}
        {(map.layers ?? []).filter((l) => l.on).map((l) => (
          <LayerImg key={l.id} blob={l.image} />
        ))}
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
