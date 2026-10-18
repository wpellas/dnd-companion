import { refreshResources } from '../data/classFeatures'
import type { AbilityScores, Character } from '../types'
import { ABILITIES, type Ability } from '../types'
import { mergeClassTable } from './character'
import { abilityMod } from './dice'
import { withGearAc } from './inventory'
import type { SrdClass, SrdClassLevel } from './srdApi'

/** What the player chose for the Ability Score Improvement of this level. */
export interface AsiChoice {
  kind: 'two' | 'split' | 'feat'
  /** 'two': one ability (+2). 'split': two different abilities (+1 each). 'feat': none. */
  abilities: Ability[]
  /** The feat or boon taken instead (a name to remember: its rules are not applied) */
  feat?: string
}

/** The levels of the SRD class table that grant an ability score improvement (or the level 19 Epic Boon). */
export const grantsAsi = (featureNames: string[]) => featureNames.some((n) => /Ability Score Improvement|Epic Boon/i.test(n))

/** The fixed hit points per level of the 2024 rules: half the die plus one (d8 -> 5), before Constitution. */
export const averageRoll = (hitDie: number) => Math.floor(hitDie / 2) + 1

export const MAX_ABILITY = 20

/** Is the choice complete and legal (nothing above 20, two different abilities for +1/+1, a name for a feat)? */
export function asiValid(scores: AbilityScores, choice: AsiChoice): boolean {
  if (choice.kind === 'feat') return !!choice.feat?.trim()
  const [a, b] = choice.abilities
  if (choice.kind === 'two') return !!a && scores[a] + 2 <= MAX_ABILITY
  return !!a && !!b && a !== b && scores[a] + 1 <= MAX_ABILITY && scores[b] + 1 <= MAX_ABILITY
}

export function applyAsi(scores: AbilityScores, choice: AsiChoice): AbilityScores {
  const next = { ...scores }
  if (choice.kind === 'two' && choice.abilities[0]) next[choice.abilities[0]] += 2
  if (choice.kind === 'split') choice.abilities.slice(0, 2).forEach((a) => (next[a] += 1))
  return next
}

export interface LevelUpInput {
  cls: SrdClass
  row: SrdClassLevel
  /** What the hit die showed (typed in by the player); left out = take the average */
  hpRoll?: number
  asi?: AsiChoice
}

export interface LevelUpPreview {
  character: Character
  /** Hit points added to the maximum (and the current value) */
  hpGain: number
  /** Part of `hpGain` that is only there because the Constitution modifier went up (it counts for every earlier level too) */
  conRetro: number
}

/**
 * The character one level higher. Hit points: the roll (or average) plus the Constitution modifier, at least 1; if an improvement raises the
 * Constitution modifier it also counts for every level so far. Initiative and Passive Perception follow Dexterity and Wisdom; spell slots,
 * spell limits and class feature uses come from the class table (spellcasting only while it is on "auto", as in the character form).
 */
export function levelUp(c: Character, input: LevelUpInput): LevelUpPreview {
  const abilities = input.asi ? applyAsi(c.abilities, input.asi) : c.abilities
  const conMod = abilityMod(abilities.con)
  const perLevel = Math.max(1, (input.hpRoll ?? averageRoll(input.cls.hit_die)) + conMod)
  const conRetro = (conMod - abilityMod(c.abilities.con)) * c.level
  const hpGain = perLevel + conRetro

  let next: Character = {
    ...c,
    level: c.level + 1,
    abilities,
    maxHp: c.maxHp + hpGain,
    currentHp: c.currentHp + hpGain,
    initiativeBonus: c.initiativeBonus + abilityMod(abilities.dex) - abilityMod(c.abilities.dex),
    passivePerception: c.passivePerception + abilityMod(abilities.wis) - abilityMod(c.abilities.wis),
  }
  next = withGearAc(mergeClassTable(next, input.cls, input.row))
  const resources = refreshResources(next.resources, { level: next.level, abilities: next.abilities, table: input.row.class_specific })
  return { character: resources === next.resources ? next : { ...next, resources }, hpGain, conRetro }
}

/** "STR +2" / "STR +1, DEX +1" for the journal. */
export const asiText = (choice: AsiChoice) =>
  choice.kind === 'feat'
    ? ''
    : choice.abilities
        .slice(0, choice.kind === 'two' ? 1 : 2)
        .map((a) => `${a.toUpperCase()} +${choice.kind === 'two' ? 2 : 1}`)
        .join(', ')

export { ABILITIES }
