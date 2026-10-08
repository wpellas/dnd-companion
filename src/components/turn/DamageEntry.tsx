import { RIDER_NOTE } from '../../lib/monsters'
import { t, tDamage } from '../../lib/i18n'
import type { DamageEntryState } from './useDamageEntry'

interface Props {
  entry: DamageEntryState
  /** 'Damage' or 'Healing' (already translated) */
  label: string
  canRoll: boolean
  crit?: boolean
}

export function DamageEntry({ entry, label, canRoll, crit }: Props) {
  const { parts } = entry
  if (parts.length === 0) return null
  const noteText = (n: string) => (n === RIDER_NOTE ? t('de.rider') : n)
  const dice = parts.filter((_, i) => entry.included(i)).map((p) => p.dice).join(' + ')
  return (
    <div className="damage-entry">
      <div className="damage-line">
        {parts.map((p, i) => (
          <div className={`part ${p.note ? 'optional' : ''}`} key={i}>
            {/* an optional extra gets its tick-box on the label line, so every input sits on the same baseline */}
            <label className="part-label" title={p.note ? t('de.onlyIf', { note: noteText(p.note) }) : undefined}>
              {p.note && <input type="checkbox" checked={entry.included(i)} onChange={(e) => entry.setIncluded(i, e.target.checked)} />}
              <span>
                {label}
                {parts.length > 1 || p.type ? ` · ${p.type ? tDamage(p.type) : t('de.untyped')}` : ''}
                {p.note ? t('de.ifNote', { note: noteText(p.note) }) : ''}
              </span>
            </label>
            <input
              className="narrow"
              type="number"
              min={0}
              value={entry.amounts[i] ?? ''}
              disabled={!entry.included(i)}
              placeholder={p.dice}
              onChange={(e) => entry.setAmount(i, e.target.value)}
              aria-label={`${label} ${p.type ? tDamage(p.type) : ''}`}
            />
          </div>
        ))}
        {canRoll ? (
          <button className="roll-btn" onClick={entry.roll}>
            {t('de.roll', { dice, crit: crit ? t('de.rollCrit') : '' })}
          </button>
        ) : (
          <span className="roll-hint">{t('de.table', { dice, crit: crit ? t('de.tableCrit') : '' })}</span>
        )}
      </div>
      {entry.detail && <div className="muted">{entry.detail}</div>}
    </div>
  )
}
