import type { Ability, Combatant, Condition } from '../types'

/**
 * What each 2024 condition does to d20 rolls and saves, taken from the official condition texts
 * (https://www.dnd5eapi.co/api/2024/conditions). This only produces reminders and rule shortcuts for the DM
 * (advantage hints, automatic failures); it never rolls anything.
 */
interface ConditionEffect {
  /** The creature's own attack rolls have Disadvantage / Advantage */
  attacksDisadv?: string
  attacksAdv?: string
  /** Attack rolls against the creature have Advantage / Disadvantage */
  attackedAdv?: boolean
  attackedDisadv?: boolean
  /** Prone: advantage for attackers within 5 feet, disadvantage otherwise */
  proneAttacked?: boolean
  /** Any hit from within 5 feet is a critical hit */
  critWithin5?: boolean
  autoFailSaves?: Ability[]
  saveDisadv?: Ability[]
  incapacitated?: boolean
  speedZero?: boolean
  /** Ability checks (not just attacks) have Disadvantage */
  checksDisadv?: boolean
  resistAll?: boolean
  /** One-line reminder shown for the creature on its turn */
  reminder: string
}

const STR_DEX: Ability[] = ['str', 'dex']

export const CONDITION_EFFECTS: Record<Condition, ConditionEffect> = {
  Blinded: { attacksDisadv: 'Blinded', attackedAdv: true, reminder: "Can't see; its attack rolls have Disadvantage and attacks against it have Advantage." },
  Charmed: { reminder: "Can't attack or harm the charmer; the charmer has Advantage on social checks against it." },
  Deafened: { reminder: "Can't hear; fails ability checks that need hearing." },
  Exhaustion: { reminder: 'Each Exhaustion level: -2 to every D20 Test and -5 ft Speed. Dies at level 6.' },
  Frightened: {
    attacksDisadv: 'Frightened (while the source of fear is in sight)',
    checksDisadv: true,
    reminder: "Disadvantage on ability checks and attack rolls while the source of fear is in sight; can't move closer to it.",
  },
  Grappled: {
    attacksDisadv: 'Grappled (unless attacking the grappler)',
    speedZero: true,
    reminder: 'Speed 0; Disadvantage on attacks against anyone but the grappler.',
  },
  Incapacitated: { incapacitated: true, reminder: "Can't take actions, Bonus Actions or Reactions; Concentration is broken; can't speak." },
  Invisible: {
    attacksAdv: 'Invisible',
    attackedDisadv: true,
    reminder: 'Its attack rolls have Advantage and attacks against it have Disadvantage (unless it can be seen somehow).',
  },
  Paralyzed: {
    incapacitated: true,
    speedZero: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    critWithin5: true,
    reminder: 'Incapacitated, Speed 0; fails STR and DEX saves; attacks against it have Advantage; hits from within 5 ft are Critical Hits.',
  },
  Petrified: {
    incapacitated: true,
    speedZero: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    resistAll: true,
    reminder: 'Incapacitated, Speed 0; fails STR and DEX saves; attacks against it have Advantage; Resistance to all damage; immune to Poisoned.',
  },
  Poisoned: { attacksDisadv: 'Poisoned', checksDisadv: true, reminder: 'Disadvantage on attack rolls and ability checks.' },
  Prone: {
    attacksDisadv: 'Prone',
    proneAttacked: true,
    reminder: 'Disadvantage on attack rolls; attacks against it have Advantage from within 5 ft, otherwise Disadvantage. Standing up costs half its Speed.',
  },
  Restrained: {
    attacksDisadv: 'Restrained',
    attackedAdv: true,
    speedZero: true,
    saveDisadv: ['dex'],
    reminder: 'Speed 0; its attack rolls and DEX saves have Disadvantage; attacks against it have Advantage.',
  },
  Stunned: {
    incapacitated: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    reminder: 'Incapacitated; fails STR and DEX saves; attacks against it have Advantage.',
  },
  Unconscious: {
    incapacitated: true,
    speedZero: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    critWithin5: true,
    reminder: 'Incapacitated and Prone, Speed 0; fails STR and DEX saves; attacks against it have Advantage; hits from within 5 ft are Critical Hits.',
  },
}

const effects = (c: Pick<Combatant, 'conditions'>) => (c.conditions ?? []).map((k) => ({ name: k, fx: CONDITION_EFFECTS[k] })).filter((e) => e.fx)

/** Exhaustion level 0-6. Each level takes 2 off every D20 Test and 5 ft off Speed; level 6 is death. */
export const exhaustionLevel = (c: Pick<Combatant, 'exhaustion'>) => Math.max(0, Math.min(6, c.exhaustion ?? 0))
export const exhaustionPenalty = (c: Pick<Combatant, 'exhaustion'>) => 2 * exhaustionLevel(c)

/** Short reminder lines for a creature's conditions (shown at the start of its turn). */
export const conditionReminders = (c: Pick<Combatant, 'conditions' | 'exhaustion'>) =>
  effects(c).map((e) => ({
    name: e.name,
    text:
      e.name === 'Exhaustion' && exhaustionLevel(c) > 0
        ? `Level ${exhaustionLevel(c)}: -${exhaustionPenalty(c)} to every D20 Test (the app applies it to attack and save bonuses) and -${5 * exhaustionLevel(c)} ft Speed. Dies at level 6.`
        : e.fx.reminder,
  }))

export const isIncapacitated = (c: Pick<Combatant, 'conditions'>) => effects(c).some((e) => e.fx.incapacitated)

/** Does a save of this ability fail automatically (Paralyzed, Stunned, Unconscious, Petrified: STR and DEX)? */
export const autoFailsSave = (c: Pick<Combatant, 'conditions'>, ability: Ability) =>
  effects(c).some((e) => e.fx.autoFailSaves?.includes(ability))

export const saveHasDisadvantage = (c: Pick<Combatant, 'conditions'>, ability: Ability) =>
  effects(c).some((e) => e.fx.saveDisadv?.includes(ability))

export const resistsAllDamage = (c: Pick<Combatant, 'conditions'>) => effects(c).some((e) => e.fx.resistAll)

export type AttackMode = 'normal' | 'adv' | 'dis'

export interface AttackAdvice {
  mode: AttackMode
  /** Everything that pushed towards advantage / disadvantage, for the hint text */
  advReasons: string[]
  disReasons: string[]
  /** A hit from this attacker counts as a Critical Hit (target Paralyzed/Unconscious and attacker within 5 ft) */
  critOnHit: string | null
}

/**
 * Work out advantage / disadvantage on an attack roll from the attacker's and target's conditions. Advantage and
 * Disadvantage cancel each other out, as in the rules. `within5` = the attacker is within 5 feet of the target.
 */
export function attackAdvice(
  attacker: Pick<Combatant, 'conditions'>,
  target: Pick<Combatant, 'conditions'>,
  within5: boolean,
): AttackAdvice {
  const adv: string[] = []
  const dis: string[] = []
  for (const e of effects(attacker)) {
    if (e.fx.attacksDisadv) dis.push(`attacker is ${e.fx.attacksDisadv}`)
    if (e.fx.attacksAdv) adv.push(`attacker is ${e.fx.attacksAdv}`)
  }
  for (const e of effects(target)) {
    if (e.fx.attackedAdv) adv.push(`target is ${e.name}`)
    if (e.fx.attackedDisadv) dis.push(`target is ${e.name}`)
    if (e.fx.proneAttacked) (within5 ? adv : dis).push(`target is Prone (${within5 ? 'within 5 ft' : 'farther than 5 ft'})`)
  }
  const crit = effects(target).find((e) => e.fx.critWithin5)
  return {
    mode: adv.length && dis.length ? 'normal' : adv.length ? 'adv' : dis.length ? 'dis' : 'normal',
    advReasons: adv,
    disReasons: dis,
    critOnHit: crit && within5 ? `target is ${crit.name} and the attacker is within 5 ft` : null,
  }
}
