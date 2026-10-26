import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { t } from '../lib/i18n'
import { advanceTime, burnLights, getCampaign, setCampaign } from '../lib/store'
import { updateSettings, useSettings } from '../lib/settings'
import { clockOf, clockText, LIGHT_PRESETS, lightLeftText, minutesUntil, newLight, periodOf } from '../lib/time'

/**
 * Campaign time for the DM: the day and the clock, and the light sources that burn down while it runs. Optional: the Settings switch (also here) hides it
 * for tables that do not track time. Nothing here is sent to the players.
 */
export function TimePanel() {
  const { trackTime } = useSettings()
  const camp = useLiveQuery(getCampaign, [])
  const [preset, setPreset] = useState(LIGHT_PRESETS[0].name)
  const [open, setOpen] = useState(false)
  if (!camp) return null
  const minutes = clockOf(camp)
  const lights = camp.lights ?? []
  const setLights = (next: typeof lights) => setCampaign({ ...camp, lights: next })

  return (
    <details className="card time-panel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{trackTime ? t('time.summary', { day: camp.day, time: clockText(minutes), period: t(`time.${periodOf(minutes)}`) }) : t('time.title')}</summary>
      <label className="check small" title={t('time.trackTitle')}>
        <input type="checkbox" checked={trackTime} onChange={(e) => updateSettings({ trackTime: e.target.checked })} />
        <span>{t('time.track')}</span>
      </label>
      {trackTime && (
        <div className="row gap wrap">
          <button onClick={() => void advanceTime(10)}>+10 {t('time.min')}</button>
          <button onClick={() => void advanceTime(60)}>+1 {t('time.hour')}</button>
          <button onClick={() => void advanceTime(480)}>+8 {t('time.hours')}</button>
          <button title={t('time.dawnTitle')} onClick={() => void advanceTime(minutesUntil(camp, 6 * 60))}>
            {t('time.toDawn')}
          </button>
          <label className="inline-field">
            {t('time.set')}
            <input
              type="time"
              value={clockText(minutes)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                if (!Number.isNaN(h) && !Number.isNaN(m)) void setCampaign({ ...camp, minutes: h * 60 + m })
              }}
            />
          </label>
        </div>
      )}

      <h4>{t('time.lights')}</h4>
      {lights.length === 0 && <p className="muted">{t('time.noLights')}</p>}
      <ul className="light-list">
        {lights.map((l) => (
          <li key={l.id} className={l.left <= 0 ? 'out' : ''}>
            <strong>{l.name}</strong>
            <span className="muted small">
              {' '}
              {t('time.radius', { bright: l.bright, dim: l.dim })} · {lightLeftText(l)}
            </span>
            <label className="check small">
              <input type="checkbox" checked={l.lit} disabled={l.left <= 0} onChange={(e) => void setLights(lights.map((x) => (x.id === l.id ? { ...x, lit: e.target.checked } : x)))} />
              <span>{t('time.lit')}</span>
            </label>
            <button className="danger" aria-label={t('common.remove')} onClick={() => void setLights(lights.filter((x) => x.id !== l.id))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="row gap wrap">
        <select value={preset} onChange={(e) => setPreset(e.target.value)} aria-label={t('time.lights')}>
          {LIGHT_PRESETS.map((p) => (
            <option key={p.name}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={() => {
            const p = LIGHT_PRESETS.find((x) => x.name === preset)
            if (p) void setLights([...lights, newLight(p)])
          }}
        >
          {t('time.light')}
        </button>
        {!trackTime && lights.some((l) => l.lit) && (
          <>
            <button className="burn" onClick={() => void burnLights(10)}>{t('time.burn10')}</button>
            <button className="burn" onClick={() => void burnLights(60)}>{t('time.burn60')}</button>
          </>
        )}
      </div>
      <p className="muted note-line">{t('time.note')}</p>
    </details>
  )
}
