import type { Action } from '../types'
import { rollDie } from './dice'

export type AttackOutcome = 'crit' | 'hit' | 'miss'
export type RollMode = 'normal' | 'adv' | 'dis'
export type DamageModifier = 'normal' | 'resist' | 'vuln'

/** A natural 20 always hits (and crits) and a natural 1 always misses, whatever the AC. */
export function attackOutcome(d20: number, bonus: number, targetAc: number): AttackOutcome {
  if (d20 === 20) return 'crit'
  if (d20 === 1) return 'miss'
  return d20 + bonus >= targetAc ? 'hit' : 'miss'
}

export function rollD20(mode: RollMode): { value: number; note: string } {
  if (mode === 'normal') {
    const v = rollDie(20)
    return { value: v, note: `rolled ${v}` }
  }
  const [a, b] = [rollDie(20), rollDie(20)]
  const value = mode === 'adv' ? Math.max(a, b) : Math.min(a, b)
  return { value, note: `rolled ${a} & ${b} (${mode === 'adv' ? 'advantage' : 'disadvantage'})` }
}

export function adjustDamage(amount: number, mod: DamageModifier) {
  if (mod === 'resist') return Math.floor(amount / 2)
  if (mod === 'vuln') return amount * 2
  return amount
}

/** Damage after a saving throw: half (rounded down) on a success if the action allows it, else none. */
export const damageAfterSave = (amount: number, action: Action, saved: boolean) =>
  saved ? (action.halfOnSave ? Math.floor(amount / 2) : 0) : amount

export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2))
