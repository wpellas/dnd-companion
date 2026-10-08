import type { SrdSpell } from './srdApi'
import { addToDice } from './character'
import { parseDice } from './dice'
import { CONDITIONS, type Ability, type Action, type CastingSnapshot, type Spellcasting } from '../types'

const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
export const levelLabel = (n: number) => ORDINAL[n] ?? `${n}th`

/** "...increases by 1d6 for each spell slot level above 3" -> { dice: '1d6', above: 3 } */
function upcastExtra(text: string) {
  const m = text.match(/increases? by (\d+d\d+) for each (?:spell )?slot level above (\d+)/i)
  return m ? { dice: m[1], above: Number(m[2]) } : null
}

/** Multiply the dice count: ("1d10", 3) -> "3d10". */
function multiplyDice(expr: string, k: number) {
  const d = parseDice(expr)
  return d && d.count ? `${d.count * k}d${d.sides}${d.mod ? (d.mod > 0 ? `+${d.mod}` : d.mod) : ''}` : expr
}

/** Add `levels` x extra dice to a base expression when the die sizes match: ("8d6", "1d6", 2) -> "10d6". */
function addDice(base: string, extra: string, levels: number) {
  const b = parseDice(base)
  const e = parseDice(extra)
  if (!b || !e || b.sides !== e.sides || levels <= 0) return base
  return `${b.count + e.count * levels}d${b.sides}${b.mod ? (b.mod > 0 ? `+${b.mod}` : b.mod) : ''}`
}

/** Cantrip damage dice scale at character levels 5, 11 and 17. */
export const cantripTier = (casterLevel: number) => 1 + (casterLevel >= 5 ? 1 : 0) + (casterLevel >= 11 ? 1 : 0) + (casterLevel >= 17 ? 1 : 0)

/** Damage expression for a spell cast at `slotLevel`, or undefined when the API has none for it. */
export function spellDamage(spell: SrdSpell, slotLevel: number, casterLevel: number): string | undefined {
  const map = spell.damage?.damage_at_slot_level
  const keys = Object.keys(map ?? {}).map(Number).sort((a, b) => a - b)
  if (!map || !keys.length) return undefined
  if (spell.level === 0) return multiplyDice(map[String(keys[0])], cantripTier(casterLevel))
  const usable = keys.filter((k) => k <= slotLevel)
  const key = usable.length ? usable[usable.length - 1] : keys[0]
  const base = map[String(key)]
  if (String(slotLevel) in map) return base
  const extra = upcastExtra(`${spell.description} ${spell.higher_level ?? ''}`)
  return extra ? addDice(base, extra.dice, slotLevel - Math.max(key, extra.above)) : base
}

/** Healing expression ("2d8+3") parsed from the spell text, e.g. Cure Wounds / Healing Word. */
function spellHealing(spell: SrdSpell, slotLevel: number, mod: number): string | undefined {
  const text = `${spell.description} ${spell.higher_level ?? ''}`
  const m = spell.description.match(/regains? (?:a number of )?Hit Points equal to (\d+d\d+)/i)
  if (!m) return undefined
  let dice = m[1]
  const extra = upcastExtra(text)
  if (extra) dice = addDice(dice, extra.dice, slotLevel - Math.max(spell.level, extra.above))
  return /plus your spellcasting ability modifier/i.test(spell.description) ? addToDice(dice, mod) : dice
}

const SAVE_NAME: Record<string, Ability> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}

/**
 * Turn an SRD spell into one of our actions for a caster. The API only structures some of this (attack type and
 * damage); the save, half-on-save, healing and condition are read from the description. Anything we can't read
 * becomes kind 'other', and the DM can still type the numbers.
 */
export function spellToAction(spell: SrdSpell, slotLevel: number, casting: CastingSnapshot): Action {
  const base: Action = {
    id: `spell:${spell.index}`,
    name: spell.name,
    kind: 'other',
    timing: /bonus/i.test(spell.casting_time) ? 'bonus' : /reaction/i.test(spell.casting_time) ? 'reaction' : 'action',
    desc: spell.description,
    area: spell.description.match(/(d+-foot(?:-radius)?[ -](?:Cone|Line|Sphere|Cube|Cylinder|Emanation|Hemisphere))/i)?.[1],
    range: spell.range,
    damage: spellDamage(spell, slotLevel, casting.casterLevel),
    damageType: spell.damage?.damage_type?.name.toLowerCase(),
  }
  const saveMatch = spell.description.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i)
  const condition = CONDITIONS.find((c) => new RegExp(`\\b${c} condition`, 'i').test(spell.description))

  if (spell.attack_type) return { ...base, kind: 'attack', attackBonus: casting.attackBonus, condition }
  if (saveMatch) {
    return {
      ...base,
      kind: 'save',
      saveAbility: SAVE_NAME[saveMatch[1].toLowerCase()],
      saveDc: casting.saveDc,
      halfOnSave: /half as much damage/i.test(spell.description),
      condition,
    }
  }
  const heal = spellHealing(spell, slotLevel, casting.mod)
  if (heal) return { ...base, kind: 'heal', damage: heal, damageType: undefined }
  return { ...base, condition }
}

export const slotsLeft = (sc: Spellcasting, level: number) => {
  const s = sc.slots[level - 1]
  return s ? Math.max(0, s.max - s.used) : 0
}

/** Total slots the caster could still spend on a spell of this level (its own level or higher, so upcasting counts). */
export const slotsLeftAtOrAbove = (sc: Spellcasting, level: number) =>
  sc.slots.reduce((sum, s, i) => (i + 1 >= level ? sum + Math.max(0, s.max - s.used) : sum), 0)

/** Slot levels (>= the spell's level) the caster can still spend, e.g. [2, 3] for a 2nd-level spell. */
export const castableLevels = (sc: Spellcasting, spellLevel: number) =>
  Array.from({ length: 9 }, (_, i) => i + 1).filter((l) => l >= Math.max(1, spellLevel) && slotsLeft(sc, l) > 0)

export const highestSlotLevel = (sc: Spellcasting) => sc.slots.reduce((hi, s, i) => (s.max > 0 ? i + 1 : hi), 0)
