import { useState } from 'react'

interface Props {
  value: number | null
  onCommit: (n: number | null) => void
}

/**
 * Initiative is committed on blur / Enter rather than per keystroke. Each commit re-sorts the
 * combat order and round-trips through IndexedDB, which made typing multi-digit or negative
 * values impossible when it was a plain controlled input.
 */
export function InitiativeInput({ value, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft !== null) {
      const n = parseFloat(draft)
      if (draft.trim() === '') onCommit(null)
      else if (!Number.isNaN(n)) onCommit(n)
    }
    setDraft(null)
  }

  return (
    <input
      className="init"
      type="number"
      placeholder="Init"
      value={draft ?? (value ?? '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
