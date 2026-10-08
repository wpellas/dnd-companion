import { exhaustionPenalty, resistsAllDamage } from './conditionRules'
import { abilityMod } from './dice'
import { t, tDamage } from './i18n'
import { ABILITIES, type Ability, type AbilityScores, type Action, type Combatant, type Condition, type DamagePart } from '../types'

/** A rolled or typed amount of one damage type, before the target's resistances. */
export interface DamageAmount {
  type: string
  amount: number
}

export type DamageEffect = 'immune' | 'resist' | 'vuln' | 'both' | 'none'

type Defences = Pick<Combatant, 'resistances' | 'immunities' | 'vulnerabilities' | 'conditions'>

/** How the target's defences change damage of this type. Petrified counts as resistance to everything. */
export function damageEffect(target: Defences, type: string): DamageEffect {
  const t = type.toLowerCase()
  if ((target.immunities ?? []).includes(t)) return 'immune'
  const resist = (target.resistances ?? []).includes(t) || resistsAllDamage(target)
  const vuln = (target.vulnerabilities ?? []).includes(t)
  return resist && vuln ? 'both' : resist ? 'resist' : vuln ? 'vuln' : 'none'
}

/** Immunity -> 0; resistance halves (rounded down); vulnerability doubles; both = halved first, then doubled. */
export function adjustDamageAmount(amount: number, effect: DamageEffect): number {
  switch (effect) {
    case 'immune':
      return 0
    case 'resist':
      return Math.floor(amount / 2)
    case 'vuln':
      return amount * 2
    case 'both':
      return Math.floor(amount / 2) * 2
    default:
      return amount
  }
}

export const effectLabel = (e: DamageEffect): string => (e === 'none' ? '' : t(`effect.${e}`))

export interface AdjustedDamage {
  total: number
  parts: DamageAmount[]
  /** Human-readable notes for each damage type that was changed, e.g. "fire: immune" */
  notes: string[]
}

/**
 * Apply a target's resistances to a damage roll, type by type. `saveFactor` handles saving throws: 'half' halves each
 * part (rounded down) before resistances, 'none' removes the damage entirely.
 */
export function adjustForTarget(parts: DamageAmount[], target: Defences, save?: 'half' | 'none'): AdjustedDamage {
  const out: DamageAmount[] = []
  const notes: string[] = []
  for (const p of parts) {
    let amount = p.amount
    if (save === 'half') amount = Math.floor(amount / 2)
    if (save === 'none') amount = 0
    const effect = damageEffect(target, p.type)
    if (effect !== 'none' && amount > 0) notes.push(`${p.type ? tDamage(p.type) : t('effect.damage')}: ${effectLabel(effect)}`)
    out.push({ type: p.type, amount: adjustDamageAmount(amount, effect) })
  }
  return { total: out.reduce((n, p) => n + p.amount, 0), parts: out, notes }
}

/** The action's damage as a list of parts: the main damage first, then any extras. */
export function actionDamageParts(a: Action): DamagePart[] {
  const main: DamagePart[] = a.damage ? [{ dice: a.damage, type: a.damageType ?? '' }] : []
  return [...main, ...(a.extraDamage ?? [])]
}

/** A creature's total saving-throw bonus for an ability (falls back to 0 for old combat records), less 2 per Exhaustion level. */
export const saveBonus = (c: Pick<Combatant, 'saves' | 'exhaustion'>, ability: Ability) => (c.saves?.[ability] ?? 0) - exhaustionPenalty(c)

/**
 * Saving-throw bonuses for a creature: the ability modifier plus proficiency for proficient saves. Monsters list the
 * finished totals for their proficient saves, passed in `totals`.
 */
export function buildSaves(
  abilities: AbilityScores,
  opts: { proficient?: Ability[]; proficiencyBonus?: number; totals?: Partial<Record<Ability, number>> },
): Record<Ability, number> {
  const out = {} as Record<Ability, number>
  for (const a of ABILITIES) {
    out[a] = opts.totals?.[a] ?? abilityMod(abilities[a]) + ((opts.proficient ?? []).includes(a) ? (opts.proficiencyBonus ?? 0) : 0)
  }
  return out
}

export const isConditionImmune = (target: Pick<Combatant, 'conditionImmunities'>, condition: Condition) =>
  (target.conditionImmunities ?? []).includes(condition)
