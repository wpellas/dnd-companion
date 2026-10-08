import { CLASSES, type Ability, type ClassIndex } from '../types'

/**
 * Hit die per class (2024 rules). The SRD API is the source of truth once reachable (see srdApi.ts); this is the
 * offline fallback and what migrations use.
 */
export const CLASS_HIT_DIE: Record<ClassIndex, number> = {
  barbarian: 12,
  bard: 8,
  cleric: 8,
  druid: 8,
  fighter: 10,
  monk: 8,
  paladin: 10,
  ranger: 10,
  rogue: 8,
  sorcerer: 6,
  warlock: 8,
  wizard: 6,
}

export const className = (index?: ClassIndex) => CLASSES.find((c) => c.index === index)?.name

/** Match free text like "Fighter 3" or "wizard" to a class, if one is named in it. */
export function guessClassIndex(text?: string): ClassIndex | undefined {
  const t = (text ?? '').toLowerCase()
  return CLASSES.find((c) => t.includes(c.index))?.index
}

/** Saving-throw proficiencies every class grants at level 1 (the same two in the 2014 and 2024 rules). */
export const CLASS_SAVES: Record<ClassIndex, Ability[]> = {
  barbarian: ['str', 'con'],
  bard: ['dex', 'cha'],
  cleric: ['wis', 'cha'],
  druid: ['int', 'wis'],
  fighter: ['str', 'con'],
  monk: ['str', 'dex'],
  paladin: ['wis', 'cha'],
  ranger: ['str', 'dex'],
  rogue: ['dex', 'int'],
  sorcerer: ['con', 'cha'],
  warlock: ['wis', 'cha'],
  wizard: ['int', 'wis'],
}
