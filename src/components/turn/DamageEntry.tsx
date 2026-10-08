import type { DamageEntryState } from './useDamageEntry'

interface Props {
  entry: DamageEntryState
  /** 'Damage' or 'Healing' */
  label: string
  canRoll: boolean
  crit?: boolean
}

export function DamageEntry({ entry, label, canRoll, crit }: Props) {
  const { parts } = entry
  if (parts.length === 0) return null
  return (
    <div className="damage-entry">
      <div className="damage-line">
        {parts.map((p, i) => (
          <div className={`part ${p.note ? 'optional' : ''}`} key={i}>
            {/* an optional extra gets its tick-box on the label line, so every input sits on the same baseline */}
            <label className="part-label" title={p.note ? `Only when this applies: ${p.note}` : undefined}>
              {p.note && <input type="checkbox" checked={entry.included(i)} onChange={(e) => entry.setIncluded(i, e.target.checked)} />}
              <span>
                {label}
                {parts.length > 1 || p.type ? ` · ${p.type || 'untyped'}` : ''}
                {p.note ? ` (if ${p.note})` : ''}
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
              aria-label={`${label} ${p.type}`}
            />
          </div>
        ))}
        {canRoll ? (
          <button className="roll-btn" onClick={entry.roll}>🎲 Roll {parts.filter((_, i) => entry.included(i)).map((p) => p.dice).join(' + ')}{crit ? ' (crit)' : ''}</button>
        ) : (
          <span className="roll-hint">
            Rolled at the table: {parts.filter((_, i) => entry.included(i)).map((p) => p.dice).join(' + ')}{crit ? ', dice doubled for the crit' : ''}
          </span>
        )}
      </div>
      {entry.detail && <div className="muted">{entry.detail}</div>}
    </div>
  )
}
