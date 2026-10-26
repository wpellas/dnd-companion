import { useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  /** Whole numbers only (gold, coins): no decimal point or comma can be typed, and a pasted "1.5" becomes 1 */
  integer?: boolean
}

/**
 * Number input that keeps what's being typed as text, so partial input like "-" or an emptied field doesn't snap
 * back. The parent only receives valid numbers. If the value is changed from outside while the draft disagrees with
 * it (a level-up recalculating a count, a "reset" button), the new value wins.
 */
export function NumberField({ label, value, onChange, min, integer }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const partial = draft === '' || draft === '-' || draft === '.'
  const shown = draft !== null && (partial || parseFloat(draft) === value) ? draft : String(value)
  const noMinus = min !== undefined && min >= 0
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isNaN(value) ? '' : shown}
        min={min}
        step={integer ? 1 : undefined}
        inputMode={integer ? 'numeric' : 'decimal'}
        onKeyDown={integer ? (e) => ['.', ',', 'e', 'E', '+'].concat(noMinus ? ['-'] : []).includes(e.key) && e.preventDefault() : undefined}
        onChange={(e) => {
          const raw = integer ? e.target.value.split(/[.,]/)[0].replace(/[^\d-]/g, '') : e.target.value
          setDraft(raw)
          const n = parseFloat(raw)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}
