import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { db } from '../db'
import { useBlobUrl } from '../hooks'
import { askConfirm } from '../lib/ask'
import { t } from '../lib/i18n'
import { addLayer, deleteLayer, moveLayer, setAllLayers, toggleLayer } from '../lib/maps'
import type { MapRecord } from '../types'
import { CheckField } from './Section'

export function LayerImg({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob)
  return url ? <img src={url} alt="" /> : null
}

/** Layers of a map: each switch decides whether the players see it; what is switched on is stacked over the map in the preview, just as the table gets it.
 *  One compact row per layer (a thumbnail says which is which), folded away under a summary so a map with many fog layers does not stretch its card. */
export function LayerList({ map, open }: { map: MapRecord; open?: boolean }) {
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
    <details className="map-layers" open={open}>
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
