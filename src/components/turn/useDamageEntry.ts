import { useState } from 'react'
import { rollDice } from '../../lib/dice'
import { actionDamageParts, type DamageAmount } from '../../lib/resolve'
import type { Action } from '../../types'

/**
 * State for entering one damage roll: an amount per damage type (typed, or rolled for monsters), with optional extras
 * ("plus 1d4 if the attack roll had Advantage") that are ticked on and off.
 */
export function useDamageEntry(action: Action, opts: { crit: boolean; advantage: boolean }) {
  const parts = actionDamageParts(action)
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [include, setInclude] = useState<Record<number, boolean | undefined>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})

  // optional extras default to "on" only when their condition is Advantage and the attack had it
  const included = (i: number) => include[i] ?? (!parts[i].note ? true : /advantage/i.test(parts[i].note!) && opts.advantage)

  return {
    parts,
    amounts,
    notes,
    included,
    setAmount: (i: number, v: string) => {
      setAmounts((a) => ({ ...a, [i]: v }))
      setNotes((n) => ({ ...n, [i]: '' }))
    },
    setIncluded: (i: number, on: boolean) => setInclude((s) => ({ ...s, [i]: on })),
    /** Roll every included part (the dice are doubled on a critical hit) */
    roll: () => {
      const a: Record<number, string> = {}
      const n: Record<number, string> = {}
      parts.forEach((p, i) => {
        if (!included(i)) return
        const r = rollDice(p.dice, opts.crit)
        if (r) {
          a[i] = String(r.total)
          n[i] = `${p.dice} ${r.note}`
        }
      })
      setAmounts(a)
      setNotes(n)
    },
    /** The entered amounts as damage by type */
    out: parts.flatMap((p, i): DamageAmount[] => (included(i) ? [{ type: p.type, amount: Number(amounts[i]) || 0 }] : [])),
    /** Every included part has a number */
    complete: parts.every((_, i) => !included(i) || (amounts[i] !== undefined && amounts[i] !== '')),
    detail: parts.map((_, i) => notes[i]).filter(Boolean).join('; '),
  }
}

export type DamageEntryState = ReturnType<typeof useDamageEntry>
