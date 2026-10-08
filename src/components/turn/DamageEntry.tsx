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
      <div className="row gap wrap">
        {parts.map((p, i) => (
          <div className="part" key={i}>
            {p.note && (
              <label className="check small" title="Only when this applies">
                <input type="checkbox" checked={entry.included(i)} onChange={(e) => entry.setIncluded(i, e.target.checked)} />
                <span>if {p.note}</span>
              </label>
            )}
            <label className="field">
              <span>
                {label}
                {parts.length > 1 || p.type ? ` · ${p.type || 'untyped'}` : ''}
              </span>
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
            </label>
          </div>
        ))}
        {canRoll ? (
          <button onClick={entry.roll}>🎲 Roll {parts.filter((_, i) => entry.included(i)).map((p) => p.dice).join(' + ')}{crit ? ' (crit)' : ''}</button>
        ) : (
          <span className="muted roll-hint">
            Rolled at the table: {parts.filter((_, i) => entry.included(i)).map((p) => p.dice).join(' + ')}{crit ? ', dice doubled for the crit' : ''}
          </span>
        )}
      </div>
      {entry.detail && <div className="muted">{entry.detail}</div>}
    </div>
  )
}
