interface Props {
  max: number
  used: number
  onChange: (used: number) => void
  label?: string
}

/** Pools bigger than this (Lay On Hands, Sorcery Points...) get a number box instead of a row of pips. */
const MAX_PIPS = 10

/**
 * Small uses tracker. Up to 10 uses show as a row of ● (available) / ○ (spent) pips: click a full pip to spend one,
 * an empty pip to get one back. Bigger pools show "remaining / max" as an editable number.
 */
export function UsePips({ max, used, onChange, label }: Props) {
  if (max <= 0) return null
  if (max > MAX_PIPS) {
    return (
      <span className="use-pool" title={label}>
        <input
          type="number"
          min={0}
          max={max}
          value={max - used}
          aria-label={`${label ?? 'uses'} remaining`}
          onChange={(e) => {
            const left = Math.floor(e.target.valueAsNumber)
            if (!Number.isNaN(left)) onChange(max - Math.min(max, Math.max(0, left)))
          }}
        />
        <span className="muted">/ {max}</span>
      </span>
    )
  }
  return (
    <span className="use-pips" title={label}>
      {Array.from({ length: max }, (_, i) => {
        const spent = i >= max - used
        return (
          <button
            key={i}
            className={spent ? 'spent' : 'avail'}
            aria-label={`${label ?? 'use'} ${spent ? 'spent' : 'available'}`}
            onClick={() => onChange(Math.min(max, Math.max(0, spent ? used - 1 : used + 1)))}
          />
        )
      })}
    </span>
  )
}
