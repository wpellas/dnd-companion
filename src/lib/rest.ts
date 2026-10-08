import type { Character, Resource } from '../types'
import { abilityMod, rollDie } from './dice'

/** Hit dice still available to spend (a character has `level` of them in total). */
export const hitDiceRemaining = (c: Character) => Math.max(0, c.level - (c.hitDiceUsed ?? 0))

/** Roll `count` hit dice: each heals its die roll + CON modifier (never below 0). */
export function rollHitDice(c: Character, count: number) {
  const con = abilityMod(c.abilities.con)
  const rolls = Array.from({ length: Math.max(0, count) }, () => rollDie(c.hitDie || 8))
  const total = rolls.reduce((sum, r) => sum + Math.max(0, r + con), 0)
  return { rolls, total, con }
}

/** What a short rest does to one feature: 'short' restores every use, 'short-one' restores a single use. */
function shortRestResource(r: Resource): Resource {
  if (r.recharge === 'short') return { ...r, used: 0 }
  if (r.recharge === 'short-one') return { ...r, used: Math.max(0, r.used - 1) }
  return r
}

/** Warlock Pact Magic slots come back on a short rest; every other class's slots need a long rest. */
const hasPactMagic = (c: Character) => c.classIndex === 'warlock'

export interface ShortRestInput {
  hitDiceSpent: number
  hpRegained: number
}

/**
 * Short rest (2024): spend Hit Dice to heal (rolled/typed by the caller), and short-rest features recharge.
 * Warlocks regain all Pact Magic slots. Returns an updated copy.
 */
export function shortRest(c: Character, input: ShortRestInput): Character {
  const spent = Math.min(Math.max(0, input.hitDiceSpent), hitDiceRemaining(c))
  return {
    ...c,
    currentHp: Math.min(c.maxHp, c.currentHp + Math.max(0, input.hpRegained)),
    hitDiceUsed: (c.hitDiceUsed ?? 0) + spent,
    resources: (c.resources ?? []).map(shortRestResource),
    spellcasting:
      c.spellcasting && hasPactMagic(c)
        ? { ...c.spellcasting, slots: c.spellcasting.slots.map((s) => ({ ...s, used: 0 })) }
        : c.spellcasting,
  }
}

/** Hit Dice regained on a long rest: half your total, minimum 1. */
export const longRestHitDice = (c: Character) => Math.max(1, Math.floor(c.level / 2))

/** Long rest (2024): full HP, half your Hit Dice back (min 1), all spell slots and all feature uses. */
export function longRest(c: Character): Character {
  return {
    ...c,
    currentHp: c.maxHp,
    hitDiceUsed: Math.max(0, (c.hitDiceUsed ?? 0) - longRestHitDice(c)),
    resources: (c.resources ?? []).map((r) => ({ ...r, used: 0 })),
    spellcasting: c.spellcasting
      ? { ...c.spellcasting, slots: c.spellcasting.slots.map((s) => ({ ...s, used: 0 })) }
      : c.spellcasting,
  }
}

/** One-line summary of what a short rest will recharge for this character (for the preview). */
export function shortRestRecharges(c: Character): string[] {
  const out = (c.resources ?? []).filter((r) => r.recharge !== 'long' && r.used > 0).map((r) => (r.recharge === 'short-one' ? `${r.name} (1 use)` : r.name))
  if (hasPactMagic(c) && c.spellcasting?.slots.some((s) => s.used > 0)) out.push('Pact Magic slots')
  return out
}
