import type { Character, Resource } from '../types'
import { abilityMod, rollDie } from './dice'
import { t } from './i18n'

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

/**
 * Features that give something back on a short rest, once per long rest (2024 SRD):
 * - Arcane Recovery (Wizard) and Natural Recovery (Circle of the Land Druid): recover spell slots of a combined level up to half the class level
 *   (rounded up), none of 6th level or higher
 * - Sorcerous Restoration (Sorcerer): regain Sorcery Points up to half the level (rounded down)
 */
export interface Recovery {
  /** The limited-use feature that is spent (its `featureId`) */
  featureId: string
  name: string
  kind: 'slots' | 'points'
  /** Combined slot levels, or sorcery points, that can come back */
  budget: number
  /** Slots: the highest slot level that qualifies */
  maxSlotLevel: number
}

/** What the player chose to recover: a count per slot level (index 0 = 1st level) or a number of points. */
export interface RecoveryChoice {
  featureId: string
  slots?: number[]
  points?: number
}

export interface ShortRestInput {
  hitDiceSpent: number
  hpRegained: number
  recover?: RecoveryChoice
}

const SLOT_RECOVERY: Record<string, { name: string; maxSlotLevel: number }> = {
  'wizard-arcane-recovery': { name: 'Arcane Recovery', maxSlotLevel: 5 },
  'druid-natural-recovery-slots': { name: 'Natural Recovery', maxSlotLevel: 5 },
}

/** Recoveries this character could use on a short rest right now: the feature is unspent and there is something to get back. */
export function shortRestRecoveries(c: Character): Recovery[] {
  const out: Recovery[] = []
  for (const r of c.resources ?? []) {
    if (!r.featureId || r.used >= r.max) continue
    const slotRule = SLOT_RECOVERY[r.featureId]
    if (slotRule && c.spellcasting) {
      const hurt = c.spellcasting.slots.some((s, i) => i + 1 <= slotRule.maxSlotLevel && s.used > 0)
      if (hurt) out.push({ featureId: r.featureId, name: slotRule.name, kind: 'slots', budget: Math.ceil(c.level / 2), maxSlotLevel: slotRule.maxSlotLevel })
    } else if (r.featureId === 'sorcerer-sorcerous-restoration') {
      const points = (c.resources ?? []).find((x) => x.featureId === 'sorcerer-sorcery-points')
      if (points && points.used > 0) out.push({ featureId: r.featureId, name: 'Sorcerous Restoration', kind: 'points', budget: Math.floor(c.level / 2), maxSlotLevel: 0 })
    }
  }
  return out
}

/** Slot levels' worth of a choice: three 1st-level slots and a 2nd-level slot are 5. */
export const slotLevelsChosen = (slots: number[] = []) => slots.reduce((n, k, i) => n + k * (i + 1), 0)

/** Apply a recovery choice, clamped to what the rules allow (budget, slot level cap, slots actually spent). */
function applyRecovery(c: Character, choice: RecoveryChoice | undefined): Character {
  const rec = choice && shortRestRecoveries(c).find((r) => r.featureId === choice.featureId)
  if (!choice || !rec) return c
  let spellcasting = c.spellcasting
  let resources = c.resources ?? []
  if (rec.kind === 'slots' && spellcasting) {
    let left = rec.budget
    const slots = spellcasting.slots.map((s) => ({ ...s }))
    // honour the request from the highest level down, so a request that is over budget loses its cheap slots first
    for (let level = Math.min(rec.maxSlotLevel, slots.length); level >= 1; level--) {
      const want = Math.min(choice.slots?.[level - 1] ?? 0, slots[level - 1].used)
      const take = Math.min(want, Math.floor(left / level))
      slots[level - 1].used -= take
      left -= take * level
    }
    spellcasting = { ...spellcasting, slots }
  } else if (rec.kind === 'points') {
    const give = Math.max(0, Math.min(choice.points ?? 0, rec.budget))
    resources = resources.map((r) => (r.featureId === 'sorcerer-sorcery-points' ? { ...r, used: Math.max(0, r.used - give) } : r))
  }
  // the feature itself is now spent until a long rest
  resources = resources.map((r) => (r.featureId === choice.featureId ? { ...r, used: r.max } : r))
  return { ...c, spellcasting, resources }
}

/**
 * Short rest (2024): spend Hit Dice to heal (rolled/typed by the caller), and short-rest features recharge.
 * Warlocks regain all Pact Magic slots. Returns an updated copy.
 */
export function shortRest(c: Character, input: ShortRestInput): Character {
  const spent = Math.min(Math.max(0, input.hitDiceSpent), hitDiceRemaining(c))
  return applyRecovery({
    ...c,
    currentHp: Math.min(c.maxHp, c.currentHp + Math.max(0, input.hpRegained)),
    hitDiceUsed: (c.hitDiceUsed ?? 0) + spent,
    resources: (c.resources ?? []).map(shortRestResource),
    spellcasting:
      c.spellcasting && hasPactMagic(c)
        ? { ...c.spellcasting, slots: c.spellcasting.slots.map((s) => ({ ...s, used: 0 })) }
        : c.spellcasting,
  }, input.recover)
}

/** Hit Dice regained on a long rest: half your total, minimum 1. */
export const longRestHitDice = (c: Character) => Math.max(1, Math.floor(c.level / 2))

/** Long rest (2024): full HP, half your Hit Dice back (min 1), all spell slots and all feature uses, and one Exhaustion level less. */
export function longRest(c: Character): Character {
  return {
    ...c,
    currentHp: c.maxHp,
    exhaustion: Math.max(0, (c.exhaustion ?? 0) - 1),
    hitDiceUsed: Math.max(0, (c.hitDiceUsed ?? 0) - longRestHitDice(c)),
    resources: (c.resources ?? []).map((r) => ({ ...r, used: 0 })),
    spellcasting: c.spellcasting
      ? { ...c.spellcasting, slots: c.spellcasting.slots.map((s) => ({ ...s, used: 0 })) }
      : c.spellcasting,
  }
}

/** One-line summary of what a short rest will recharge for this character (for the preview). */
export function shortRestRecharges(c: Character): string[] {
  const out = (c.resources ?? []).filter((r) => r.recharge !== 'long' && r.used > 0).map((r) => (r.recharge === 'short-one' ? t('rest.oneUse', { name: r.name }) : r.name))
  if (hasPactMagic(c) && c.spellcasting?.slots.some((s) => s.used > 0)) out.push(t('rest.pactSlots'))
  return out
}
