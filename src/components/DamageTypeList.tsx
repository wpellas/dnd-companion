import { DAMAGE_TYPES } from '../types'

interface Props {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  hint?: string
}

/** A small editable set of damage types (resistances, immunities, vulnerabilities). */
export function DamageTypeList({ label, value, onChange, hint }: Props) {
  const remaining = DAMAGE_TYPES.filter((t) => !value.includes(t))
  return (
    <div className="damage-list">
      <div className="subhead" title={hint}>
        {label}
      </div>
      <div className="spell-chips">
        {value.map((t) => (
          <span className="spell-chip" key={t}>
            {t}
            <button className="x" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              ✕
            </button>
          </span>
        ))}
        {remaining.length > 0 && (
          <select
            className="add-type"
            value=""
            aria-label={`Add ${label.toLowerCase()}`}
            onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          >
            <option value="">+ add…</option>
            {remaining.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {value.length === 0 && <span className="muted">none</span>}
      </div>
    </div>
  )
}
