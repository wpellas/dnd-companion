import type { Action, Combatant, DamagePart } from '../types'
import { attackAdvice, exhaustionPenalty, type AttackAdvice } from './conditionRules'
import { adjustForTarget, actionDamageParts, type AdjustedDamage, type DamageAmount } from './resolve'
import { attackOutcome, type AttackOutcome } from './rules'

/**
 * Several separate attacks in one go: the rays of Scorching Ray, the darts of Magic Missile, the beams of Eldritch Blast,
 * or a monster's Multiattack. Every attack has its own target, d20 and damage. This is the pure part (no React).
 */

/** One attack of the sequence: the action(s) it may be (a Multiattack step can offer a choice), and whether it needs a roll. */
export interface Step {
  actions: Action[]
  autoHit?: boolean
}

/** What the DM has entered for one attack. */
export interface RowState {
  targetId?: string
  /** Which of the step's actions this attack uses */
  actionIndex: number
  d20: string
  amounts: Record<number, string>
  extras: Record<number, boolean | undefined>
}

export const newRow = (): RowState => ({ actionIndex: 0, d20: '', amounts: {}, extras: {} })

/** N identical attacks (a spell's rays, darts or beams). */
export const stepsFromVolley = (action: Action): Step[] =>
  Array.from({ length: Math.max(1, action.volley?.count ?? 1) }, () => ({ actions: [action], autoHit: action.volley?.autoHit }))

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/** Find an action by the name a Multiattack uses; tolerates plurals ("Claws" for a "Claw" action). */
function findAction(actions: Action[], name: string): Action | undefined {
  const n = norm(name)
  const pool = actions.filter((a) => a.kind === 'attack' && !a.multiattack)
  return pool.find((a) => norm(a.name) === n) ?? pool.find((a) => norm(a.name).replace(/s$/, '') === n.replace(/s$/, ''))
}

/**
 * The steps of a Multiattack, resolved against the creature's own attack actions. Names it can't find (a spell the
 * creature casts instead, say) are returned in `missing` so the panel can mention them.
 */
export function stepsFromMultiattack(multi: Action, actions: Action[]): { steps: Step[]; missing: string[] } {
  const steps: Step[] = []
  const missing = new Set<string>()
  for (const row of multi.multiattack ?? []) {
    const found = row.choices.map((n) => ({ n, a: findAction(actions, n) }))
    found.filter((f) => !f.a).forEach((f) => missing.add(f.n))
    const options = found.map((f) => f.a).filter((a): a is Action => !!a)
    if (options.length) steps.push({ actions: options })
  }
  return { steps, missing: [...missing] }
}

export interface RowResult {
  action: Action
  autoHit: boolean
  parts: DamagePart[]
  /** Which parts count: optional extras ("if the attack roll had Advantage") are ticked on and off */
  included: boolean[]
  bonus: number
  roll?: number
  outcome: AttackOutcome | null
  hit: boolean
  advice?: AttackAdvice
  out: DamageAmount[]
  adjusted?: AdjustedDamage
  /** Everything needed to apply this attack has been entered */
  complete: boolean
  detail: string
}

const MODE_WORD = { normal: '', adv: ' (advantage)', dis: ' (disadvantage)' } as const

/** Work out one attack: hit or miss, the damage entered, and what the target takes after its defences. */
export function evaluateRow(row: RowState, step: Step, attacker: Combatant, target: Combatant | undefined, within5: boolean): RowResult {
  const action = step.actions[Math.min(row.actionIndex, step.actions.length - 1)]
  const autoHit = !!step.autoHit
  const penalty = exhaustionPenalty(attacker)
  const bonus = (action.attackBonus ?? 0) - penalty
  const roll = row.d20 === '' ? undefined : Number(row.d20)
  const advice = target ? attackAdvice(attacker, target, within5) : undefined
  const parts = actionDamageParts(action)
  const included = parts.map((p, i) => row.extras[i] ?? (!p.note ? true : /advantage/i.test(p.note) && advice?.mode === 'adv'))

  let outcome: AttackOutcome | null = null
  if (target) {
    if (autoHit) outcome = 'hit'
    else if (roll !== undefined && !Number.isNaN(roll)) {
      const base = attackOutcome(roll, bonus, target.ac)
      outcome = base === 'hit' && advice?.critOnHit ? 'crit' : base
    }
  }
  const hit = outcome === 'hit' || outcome === 'crit'
  const out = parts.flatMap((p, i): DamageAmount[] => (included[i] ? [{ type: p.type, amount: Number(row.amounts[i]) || 0 }] : []))
  const filled = parts.every((_, i) => !included[i] || (row.amounts[i] !== undefined && row.amounts[i] !== ''))
  const adjusted = target && hit ? adjustForTarget(out, target) : undefined
  const complete = !!target && outcome !== null && (!hit || parts.length === 0 || filled)

  const how = autoHit
    ? 'auto-hit'
    : `d20 ${roll} ${bonus >= 0 ? '+' : ''}${bonus} = ${(roll ?? 0) + bonus} vs AC ${target?.ac ?? '?'}${advice ? MODE_WORD[advice.mode] : ''}${penalty ? ` (Exhaustion -${penalty})` : ''}`
  return { action, autoHit, parts, included, bonus, roll, outcome, hit, advice, out, adjusted, complete, detail: how }
}
