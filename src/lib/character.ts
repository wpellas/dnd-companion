import { ABILITIES, type Ability, type Action, type CastingSnapshot, type Character, type SlotState } from '../types'
import { CLASS_HIT_DIE, CLASS_SAVES } from './classes'
import { abilityMod, parseDice } from './dice'
import { emptyCoins, weaponActions } from './inventory'
import type { SrdClass, SrdClassLevel } from './srdApi'

type Owner = Pick<Character, 'level' | 'abilities'>

/** Proficiency bonus by character level (+2 at 1-4 ... +6 at 17-20). */
export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.min(20, Math.max(1, level || 1)) - 1) / 4)

/** Adds a flat bonus to a dice expression: ("2d6", 4) -> "2d6+4". Unparseable input is returned unchanged. */
export function addToDice(expr: string | undefined, bonus: number): string | undefined {
  if (!expr) return expr
  const d = parseDice(expr)
  if (!d) return expr
  const mod = d.mod + bonus
  if (d.count === 0) return String(mod)
  return `${d.count}d${d.sides}${mod === 0 ? '' : mod > 0 ? `+${mod}` : mod}`
}

/**
 * Resolves a character action that is tied to a stat (`ability` set) into flat numbers the combat flow uses.
 * Actions without `ability` pass through untouched.
 */
export function deriveAction(a: Action, owner: Owner): Action {
  if (!a.ability) return a
  const mod = abilityMod(owner.abilities[a.ability])
  const pb = proficiencyBonus(owner.level)
  const magic = a.kind === 'attack' ? (a.magicBonus ?? 0) : 0
  const out: Action = { ...a }
  if (a.kind === 'attack') out.attackBonus = mod + (a.proficient ? pb : 0) + magic
  if (a.kind === 'save') out.saveDc = 8 + pb + mod
  out.damage = addToDice(a.damage, a.kind === 'save' ? 0 : mod + magic)
  return out
}

export const emptySlots = (): SlotState[] => Array.from({ length: 9 }, () => ({ max: 0, used: 0 }))

/** Fill in fields added after a character was saved, so the editor and combat can rely on them. */
export function normalizeCharacter(c: Character): Character {
  return {
    ...c,
    subclass: c.subclass ?? '',
    actions: c.actions ?? [],
    hitDie: c.hitDie ?? (c.classIndex ? CLASS_HIT_DIE[c.classIndex] : 8),
    hitDiceUsed: c.hitDiceUsed ?? 0,
    resources: c.resources ?? [],
    saveProficiencies: c.saveProficiencies ?? (c.classIndex ? CLASS_SAVES[c.classIndex] : []),
    resistances: c.resistances ?? [],
    immunities: c.immunities ?? [],
    vulnerabilities: c.vulnerabilities ?? [],
    items: c.items ?? [],
    coins: { ...emptyCoins(), ...c.coins },
    xp: c.xp ?? 0,
  }
}

/**
 * Apply the class's table row (hit die, spell slots, cantrips/prepared limits) to a character. Slot counts and
 * limits are only touched while `spellcasting.auto` is on, so hand-edited values (e.g. a multiclass or a subclass
 * caster the SRD doesn't cover) are never overwritten. Spent slots and chosen spells are always kept.
 */
export function mergeClassTable(c: Character, cls: SrdClass, row: SrdClassLevel): Character {
  const withDie = { ...c, hitDie: cls.hit_die }
  const sc = row.spellcasting
  const abilityIndex = cls.spellcasting?.spellcasting_ability.index
  const prev = c.spellcasting
  if (!sc || !abilityIndex || !(ABILITIES as readonly string[]).includes(abilityIndex)) return withDie
  if (prev && !prev.auto) return withDie
  const slots = Array.from({ length: 9 }, (_, i): SlotState => {
    const max = sc[`spell_slots_level_${i + 1}`] ?? 0
    return { max, used: Math.min(prev?.slots[i]?.used ?? 0, max) }
  })
  return {
    ...withDie,
    spellcasting: {
      ability: abilityIndex as Ability,
      slots,
      cantripLimit: sc.cantrips_known ?? 0,
      preparedLimit: sc.prepared_spells ?? 0,
      cantrips: prev?.cantrips ?? [],
      prepared: prev?.prepared ?? [],
      auto: true,
    },
  }
}

/** Spellcasting numbers frozen onto a PC when they join a fight (slots stay live on the character). */
export function castingSnapshot(c: Character): CastingSnapshot | undefined {
  const sc = c.spellcasting
  if (!sc) return undefined
  const mod = abilityMod(c.abilities[sc.ability])
  const pb = proficiencyBonus(c.level)
  return { ability: sc.ability, mod, attackBonus: mod + pb, saveDc: 8 + pb + mod, casterLevel: c.level }
}

/** A character's actions for a fight: the ones they wrote, plus an attack for every equipped weapon, all resolved against their stats. */
export const resolveCharacterActions = (c: Character): Action[] => [...(c.actions ?? []), ...weaponActions(c)].map((a) => deriveAction(a, c))
