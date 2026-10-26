import { natOf, type RollKind } from '../lib/rolls'

/** A d20-shaped token with the number a player typed. A natural 20 turns gold, a natural 1 goes dark. The words beside it carry the meaning (it is decoration for the eye). */
export function DieToken({ value, kind, large }: { value?: number; kind: RollKind; large?: boolean }) {
  const nat = value === undefined ? undefined : natOf(kind, value)
  return (
    <span className={`die ${nat ?? ''} ${large ? 'large' : ''} ${value === undefined ? 'ghost' : ''}`} aria-hidden="true">
      <span className="die-num">{value ?? '?'}</span>
    </span>
  )
}
