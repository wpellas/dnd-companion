import { useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
}

/**
 * Number input that keeps what's being typed as text, so partial input like "-" or an emptied field doesn't snap
 * back. The parent only receives valid numbers. If the value is changed from outside while the draft disagrees with
 * it (a level-up recalculating a count, a "reset" button), the new value wins.
 */
export function NumberField({ label, value, onChange, min }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const partial = draft === '' || draft === '-' || draft === '.'
  const shown = draft !== null && (partial || parseFloat(draft) === value) ? draft : String(value)
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isNaN(value) ? '' : shown}
        min={min}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parseFloat(e.target.value)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}
