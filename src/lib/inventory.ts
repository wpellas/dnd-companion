import type { SrdEquipment, SrdMagicItem } from './srdApi'
import { abilityMod } from './dice'
import { newId } from './id'
import { t } from './i18n'
import type { Ability, Action, Character, Coins, CoinType, Item } from '../types'

/** Pure rules for what a character owns: Armor Class from gear, weapon attacks, coins, carrying weight, experience. */

type Gear = Pick<Character, 'items' | 'abilities' | 'classIndex'>

/* ---------------------------------------------------------------------------------------------------------------- */
/* Experience                                                                                                        */
/* ---------------------------------------------------------------------------------------------------------------- */

/** XP needed to reach each level (index 0 = level 1), from the 2024 Player's Handbook table. */
export const XP_FOR_LEVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

/** The level a pile of XP is worth (1-20). */
export const levelForXp = (xp: number) => XP_FOR_LEVEL.reduce((lvl, need, i) => (xp >= need ? i + 1 : lvl), 1)

/** XP at which the next level is reached, or undefined at level 20. */
export const xpForNextLevel = (level: number) => XP_FOR_LEVEL[Math.min(20, Math.max(1, level))]

/** The character has enough XP for a higher level than they are at. */
export const canLevelUp = (c: Pick<Character, 'xp' | 'level'>) => c.level < 20 && levelForXp(c.xp ?? 0) > c.level

/** Split a whole number evenly; the leftovers go one each to the first people. */
export function splitEvenly(total: number, people: number): number[] {
  if (people <= 0) return []
  const whole = Math.max(0, Math.floor(total))
  const base = Math.floor(whole / people)
  const extra = whole - base * people
  return Array.from({ length: people }, (_, i) => base + (i < extra ? 1 : 0))
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Coins                                                                                                             */
/* ---------------------------------------------------------------------------------------------------------------- */

export const emptyCoins = (): Coins => ({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })

const GP_VALUE: Record<CoinType, number> = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 }

/** Everything the coins are worth, in gold pieces. */
export const totalGp = (c?: Coins) => (Object.keys(GP_VALUE) as CoinType[]).reduce((n, k) => n + (c?.[k] ?? 0) * GP_VALUE[k], 0)

/** 50 coins weigh a pound. */
const coinCount = (c?: Coins) => (Object.keys(GP_VALUE) as CoinType[]).reduce((n, k) => n + (c?.[k] ?? 0), 0)

/* ---------------------------------------------------------------------------------------------------------------- */
/* Weight                                                                                                            */
/* ---------------------------------------------------------------------------------------------------------------- */

export const carryingCapacity = (c: Pick<Character, 'abilities'>) => (c.abilities?.str ?? 10) * 15

/** Pounds carried: every item times its quantity, plus the coins. */
export const carriedWeight = (c: Pick<Character, 'items' | 'coins'>) =>
  (c.items ?? []).reduce((n, i) => n + (i.weight ?? 0) * Math.max(0, i.qty), 0) + coinCount(c.coins) / 50

/* ---------------------------------------------------------------------------------------------------------------- */
/* Armor Class                                                                                                       */
/* ---------------------------------------------------------------------------------------------------------------- */

const dexPart = (mode: 'full' | 'max2' | 'none', dex: number) => (mode === 'none' ? 0 : mode === 'max2' ? Math.min(dex, 2) : dex)

export interface ArmorClassResult {
  ac: number
  /** "Chain Mail 16", "Shield +2"... for the hint under the field */
  parts: string[]
  /** More than one body armor is equipped: only the best counts */
  warning?: string
}

/**
 * Armor Class from what is equipped: the best body armor (or 10 + Dex, plus Con for a Barbarian / Wis for a Monk
 * who wears none), the best shield, and the bonus of any equipped magic item that gives one (a cloak of protection...).
 */
export function armorClass(c: Gear): ArmorClassResult {
  const dex = abilityMod(c.abilities?.dex ?? 10)
  const worn = (c.items ?? []).filter((i) => i.equipped && i.armor)
  const bodies = worn.filter((i) => i.kind === 'armor')
  const shields = worn.filter((i) => i.kind === 'shield')
  const bodyValue = (i: Item) => i.armor!.base + dexPart(i.armor!.dex, dex) + (i.magicBonus ?? 0)
  const body = [...bodies].sort((a, b) => bodyValue(b) - bodyValue(a))[0]
  const shield = [...shields].sort((a, b) => b.armor!.base + (b.magicBonus ?? 0) - (a.armor!.base + (a.magicBonus ?? 0)))[0]

  const parts: string[] = []
  let ac: number
  if (body) {
    ac = bodyValue(body)
    parts.push(`${body.name} ${ac}`)
  } else {
    // unarmored: 10 + Dex, and the Barbarian / Monk features that add a second ability
    const extra = c.classIndex === 'barbarian' ? abilityMod(c.abilities?.con ?? 10) : c.classIndex === 'monk' && !shield ? abilityMod(c.abilities?.wis ?? 10) : 0
    ac = 10 + dex + extra
    parts.push(t(extra ? 'ac.unarmoredDefense' : 'ac.unarmored', { n: ac }))
  }
  if (shield) {
    const bonus = shield.armor!.base + (shield.magicBonus ?? 0)
    ac += bonus
    parts.push(`${shield.name} +${bonus}`)
  }
  for (const i of (c.items ?? []).filter((x) => x.equipped && x.kind === 'magic' && x.magicBonus)) {
    ac += i.magicBonus!
    parts.push(`${i.name} ${i.magicBonus! > 0 ? '+' : ''}${i.magicBonus}`)
  }
  return { ac, parts, warning: bodies.length > 1 ? t('ac.severalArmors') : undefined }
}

/** Keep `ac` in step with the gear when the character uses "Armor Class from equipment". */
export const withGearAc = <T extends Character>(c: T): T => (c.acFromGear ? { ...c, ac: armorClass(c).ac } : c)

/* ---------------------------------------------------------------------------------------------------------------- */
/* Weapon attacks                                                                                                    */
/* ---------------------------------------------------------------------------------------------------------------- */

/**
 * An attack for every equipped weapon (two for a Versatile weapon), derived from the character's stats like any
 * "from my stats" action: Strength for melee, Dexterity for ranged, the better of the two for Finesse.
 */
export function weaponActions(c: Pick<Character, 'items' | 'abilities'>): Action[] {
  const str = c.abilities?.str ?? 10
  const dex = c.abilities?.dex ?? 10
  return (c.items ?? [])
    .filter((i) => i.equipped && i.kind === 'weapon' && i.weapon)
    .flatMap((i) => {
      const w = i.weapon!
      const ability: Ability = w.ranged ? 'dex' : w.finesse ? (str >= dex ? 'str' : 'dex') : 'str'
      const base: Action = {
        id: `item:${i.id}`,
        name: i.name,
        kind: 'attack',
        timing: 'action',
        ability,
        proficient: w.proficient,
        magicBonus: i.magicBonus || undefined,
        damage: w.damage,
        damageType: w.damageType,
        range: w.range ?? (w.ranged ? 'range' : 'reach 5 ft.'),
        desc: w.mastery ? t('inv.masteryDesc', { m: w.mastery }) : undefined,
      }
      return w.versatile ? [base, { ...base, id: `item:${i.id}:2h`, name: `${i.name} (two-handed)`, damage: w.versatile }] : [base]
    })
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Items from the SRD list                                                                                           */
/* ---------------------------------------------------------------------------------------------------------------- */

export const blankItem = (kind: Item['kind'] = 'gear'): Item => ({ id: newId(), name: '', kind, qty: 1 })

/** Headings of the item picker (translated where they are shown). */
export type CatalogGroup = 'weapons' | 'armor' | 'gear' | 'magic'

/** Group and short hint for the picker, from an SRD equipment entry (the damage type is translated where it is shown). */
export function equipmentGroup(e: SrdEquipment): { group: CatalogGroup; hint?: string; damageType?: string } {
  if (e.damage) return { group: 'weapons', hint: e.damage.damage_dice, damageType: e.damage.damage_type?.index }
  if (e.armor_class) return { group: 'armor', hint: e.equipment_categories.some((c) => c.index === 'shields') ? `+${e.armor_class.base} AC` : `AC ${e.armor_class.base}` }
  return { group: 'gear', hint: e.cost ? `${e.cost.quantity} ${e.cost.unit}` : undefined }
}

const text = (lines?: string[]) => (lines?.length ? lines.join('\n\n') : undefined)

/** An inventory item from an SRD equipment entry: weapons, armor and shields get their combat numbers. */
export function itemFromEquipment(e: SrdEquipment): Item {
  const cats = e.equipment_categories.map((c) => c.index)
  const props = (e.properties ?? []).map((p) => p.index)
  const base: Item = { id: newId(), name: e.name, kind: 'gear', qty: 1, weight: e.weight || undefined, desc: text(e.description), srd: { source: 'equipment', index: e.index } }
  if (e.damage) {
    const ranged = cats.includes('ranged-weapons')
    const range = ranged && e.range ? `range ${e.range.normal}${e.range.long ? `/${e.range.long}` : ''} ft.` : props.includes('reach') ? 'reach 10 ft.' : 'reach 5 ft.'
    return {
      ...base,
      kind: 'weapon',
      weapon: {
        damage: e.damage.damage_dice,
        damageType: e.damage.damage_type?.index ?? 'slashing',
        versatile: props.includes('versatile') ? e.two_handed_damage?.damage_dice : undefined,
        ranged,
        finesse: props.includes('finesse'),
        range,
        mastery: e.mastery?.name,
        proficient: true,
      },
    }
  }
  if (e.armor_class) {
    const shield = cats.includes('shields')
    const dex = !e.armor_class.dex_bonus ? 'none' : e.armor_class.max_bonus === 2 ? 'max2' : 'full'
    return { ...base, kind: shield ? 'shield' : 'armor', armor: { base: e.armor_class.base, dex } }
  }
  return base
}

/** An inventory item from an SRD magic item. */
export function itemFromMagicItem(m: SrdMagicItem): Item {
  return {
    id: newId(),
    name: m.name,
    kind: 'magic',
    qty: 1,
    desc: text(m.desc),
    notes: m.rarity?.name,
    requiresAttunement: m.attunement || undefined,
    srd: { source: 'magic-items', index: m.index },
  }
}

/** Items attuned right now (the limit is three). */
export const attunedCount = (items: Item[] = []) => items.filter((i) => i.attuned).length
