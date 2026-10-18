import type { Ability, Combatant, Condition } from '../types'
import { t, tCondition } from './i18n'

/**
 * What each 2024 condition does to d20 rolls and saves, taken from the official condition texts
 * (https://www.dnd5eapi.co/api/2024/conditions). This only produces reminders and rule shortcuts for the DM
 * (advantage hints, automatic failures); it never rolls anything.
 */
interface ConditionEffect {
  /** The creature's own attack rolls have Disadvantage / Advantage */
  attacksDisadv?: boolean
  attacksAdv?: boolean
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
}

const STR_DEX: Ability[] = ['str', 'dex']

export const CONDITION_EFFECTS: Record<Condition, ConditionEffect> = {
  Blinded: { attacksDisadv: true, attackedAdv: true },
  Charmed: {},
  Deafened: {},
  Exhaustion: {},
  Frightened: {
    attacksDisadv: true,
    checksDisadv: true,
  },
  Grappled: {
    attacksDisadv: true,
    speedZero: true,
  },
  Incapacitated: { incapacitated: true },
  Invisible: {
    attacksAdv: true,
    attackedDisadv: true,
  },
  Paralyzed: {
    incapacitated: true,
    speedZero: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    critWithin5: true,
  },
  Petrified: {
    incapacitated: true,
    speedZero: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    resistAll: true,
  },
  Poisoned: { attacksDisadv: true, checksDisadv: true },
  Prone: {
    attacksDisadv: true,
    proneAttacked: true,
  },
  Restrained: {
    attacksDisadv: true,
    attackedAdv: true,
    speedZero: true,
    saveDisadv: ['dex'],
  },
  Stunned: {
    incapacitated: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
  },
  Unconscious: {
    incapacitated: true,
    speedZero: true,
    autoFailSaves: STR_DEX,
    attackedAdv: true,
    critWithin5: true,
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
    label: tCondition(e.name),
    text:
      e.name === 'Exhaustion' && exhaustionLevel(c) > 0
        ? t('remind.exhaustionLevel', { n: exhaustionLevel(c), pen: exhaustionPenalty(c), ft: 5 * exhaustionLevel(c) })
        : t(`remind.${e.name}`),
  }))

export const isIncapacitated = (c: Pick<Combatant, 'conditions'>) => effects(c).some((e) => e.fx.incapacitated)

/** Does a save of this ability fail automatically (Paralyzed, Stunned, Unconscious, Petrified: STR and DEX)? */
export const autoFailsSave = (c: Pick<Combatant, 'conditions'>, ability: Ability) =>
  effects(c).some((e) => e.fx.autoFailSaves?.includes(ability))

export const saveHasDisadvantage = (c: Pick<Combatant, 'conditions'>, ability: Ability) =>
  effects(c).some((e) => e.fx.saveDisadv?.includes(ability))

export const resistsAllDamage = (c: Pick<Combatant, 'conditions'>) => effects(c).some((e) => e.fx.resistAll)

/** Why the attacker's own condition gives them advantage or disadvantage. */
const attackerReason = (c: Condition) =>
  c === 'Frightened' ? t('reason.attackerFrightened') : c === 'Grappled' ? t('reason.attackerGrappled') : t('reason.attackerIs', { cond: tCondition(c) })

/** AC with the bonuses of the creature's effects (Shield of Faith +2, Shield +5, Slow -2...). */
export const effectiveAc = (c: Pick<Combatant, 'ac' | 'effects'>) => c.ac + (c.effects ?? []).reduce((n, e) => n + (e.mods?.ac ?? 0), 0)

/**
 * Walking Speed right now, or undefined when the creature has none recorded (old fights). Haste doubles it, Slow halves it, each Exhaustion level takes
 * 5 ft off, and Grappled / Restrained / Paralyzed / Petrified / Unconscious make it 0.
 */
export function effectiveSpeed(c: Pick<Combatant, 'speed' | 'conditions' | 'exhaustion' | 'effects'>): number | undefined {
  if (c.speed === undefined) return undefined
  if (effects(c).some((e) => e.fx.speedZero)) return 0
  let speed = c.speed
  for (const e of c.effects ?? []) {
    if (e.mods?.speed === 'double') speed *= 2
    if (e.mods?.speed === 'half') speed = Math.floor(speed / 2)
  }
  return Math.max(0, speed - 5 * exhaustionLevel(c))
}

/** Feet of movement left this turn: Speed (again for every Dash) less what was moved. */
export function movementLeft(c: Pick<Combatant, 'speed' | 'conditions' | 'exhaustion' | 'effects' | 'turn'>): number | undefined {
  const speed = effectiveSpeed(c)
  return speed === undefined ? undefined : speed * (1 + (c.turn?.dashes ?? 0)) - (c.turn?.moved ?? 0)
}

/** Does an effect give resistance to this damage type (Rage)? */
export const effectResists = (c: Pick<Combatant, 'effects'>, type: string) => (c.effects ?? []).some((e) => e.mods?.resist?.includes(type.toLowerCase()))

export type AttackMode = 'normal' | 'adv' | 'dis'

export interface AttackAdvice {
  mode: AttackMode
  /** Everything that pushed towards advantage / disadvantage, for the hint text */
  advReasons: string[]
  disReasons: string[]
  /** A hit from this attacker counts as a Critical Hit (target Paralyzed/Unconscious and attacker within 5 ft) */
  critOnHit: string | null
  /** Reminders from the attacker's own effects (Bless, Bane, Rage) */
  notes: string[]
}

/**
 * Work out advantage / disadvantage on an attack roll from the attacker's and target's conditions. Advantage and
 * Disadvantage cancel each other out, as in the rules. `within5` = the attacker is within 5 feet of the target.
 */
export function attackAdvice(
  attacker: Pick<Combatant, 'conditions' | 'effects'>,
  target: Pick<Combatant, 'conditions' | 'effects'>,
  within5: boolean,
): AttackAdvice {
  const adv: string[] = []
  const dis: string[] = []
  for (const e of effects(attacker)) {
    if (e.fx.attacksDisadv) dis.push(attackerReason(e.name))
    if (e.fx.attacksAdv) adv.push(attackerReason(e.name))
  }
  for (const e of effects(target)) {
    if (e.fx.attackedAdv) adv.push(t('reason.targetIs', { cond: tCondition(e.name) }))
    if (e.fx.attackedDisadv) dis.push(t('reason.targetIs', { cond: tCondition(e.name) }))
    if (e.fx.proneAttacked) (within5 ? adv : dis).push(t(within5 ? 'reason.proneNear' : 'reason.proneFar'))
  }
  for (const e of target.effects ?? []) {
    if (e.mods?.attackersAdvantage) adv.push(t('reason.targetEffect', { effect: e.name }))
    if (e.mods?.attackersDisadvantage) dis.push(t('reason.targetEffect', { effect: e.name }))
  }
  const notes = (attacker.effects ?? []).flatMap((e) => (e.mods?.note ? [`${e.name}: ${t(e.mods.note as Parameters<typeof t>[0])}`] : []))
  const crit = effects(target).find((e) => e.fx.critWithin5)
  return {
    mode: adv.length && dis.length ? 'normal' : adv.length ? 'adv' : dis.length ? 'dis' : 'normal',
    advReasons: adv,
    disReasons: dis,
    notes,
    critOnHit: crit && within5 ? t('reason.crit', { cond: tCondition(crit.name) }) : null,
  }
}
