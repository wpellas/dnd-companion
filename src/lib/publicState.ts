import { ABILITIES, type Character, type Combatant, type CombatState, type Condition, type PublicEvent } from '../types'
import { hpStatus, type HpStatus } from './combat'
import { normalizeCharacter, proficiencyBonus, castingSnapshot, resolveCharacterActions } from './character'
import { abilityMod, formatMod } from './dice'
import { carriedWeight, carryingCapacity, xpForNextLevel } from './inventory'
import { t, tAbility, tClass, tDamage } from './i18n'
import { hitDiceRemaining } from './rest'

/**
 * What the table is allowed to see. This is the only thing ever sent to other devices: monsters appear with a
 * Healthy / Bloodied / Defeated status and no HP, AC, saves or actions; the DM's log and undo history stay private.
 */
export interface PublicCombatant {
  id: string
  kind: Combatant['kind']
  name: string
  characterId?: number
  initiative: number | null
  /** Player characters only */
  hp?: number
  maxHp?: number
  tempHp?: number
  deathSaves?: { successes: number; failures: number }
  status: HpStatus
  conditions: Condition[]
  /** Exhaustion level 1-6, if any */
  exhaustion?: number
  concentrating: boolean
}

export interface PublicCombat {
  combatants: PublicCombatant[]
  round: number
  turnIndex: number
  started: boolean
  events: PublicEvent[]
}

export function toPublic(s: CombatState | undefined): PublicCombat | undefined {
  if (!s) return undefined
  return {
    round: s.round,
    turnIndex: s.turnIndex,
    started: s.started,
    events: s.events ?? [],
    combatants: s.combatants.map((c): PublicCombatant => {
      const base = {
        id: c.id,
        kind: c.kind,
        name: c.name,
        characterId: c.characterId,
        initiative: c.initiative,
        status: hpStatus(c),
        conditions: c.conditions ?? [],
        exhaustion: c.exhaustion || undefined,
        concentrating: c.concentrating,
      }
      return c.kind === 'pc' ? { ...base, hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp, deathSaves: c.hp === 0 ? c.deathSaves : undefined } : base
    }),
  }
}

/* ---------------------------------------------------------------- character spotlight */

/**
 * One character's sheet, for the DM to put on the players' screens ("display to players"). Only things a player
 * knows about their own character; the DM chooses whether the inventory and gold are included.
 */
export interface PublicSheet {
  id: number
  name: string
  playerName: string
  /** "Wizard 5 (Evoker)" */
  classLine: string
  level: number
  ac: number
  hp: number
  maxHp: number
  tempHp: number
  speed: number
  initiativeBonus: number
  passivePerception: number
  proficiencyBonus: number
  hitDie: string
  hitDiceLeft: number
  exhaustion: number
  deathSaves?: { successes: number; failures: number }
  concentrating: boolean
  conditions: Condition[]
  abilities: { key: string; score: number; mod: number; save: number; proficient: boolean }[]
  defences: { resistances: string[]; immunities: string[]; vulnerabilities: string[] }
  attacks: { name: string; detail: string }[]
  spellcasting?: {
    ability: string
    saveDc: number
    attackBonus: number
    slots: { level: number; max: number; used: number }[]
    cantrips: string[]
    prepared: { level: number; names: string[] }[]
  }
  features: { name: string; max: number; used: number }[]
  /** Left out entirely when the DM keeps the inventory private */
  inventory?: {
    coins: Record<string, number>
    xp: number
    nextXp?: number
    items: { name: string; qty: number; equipped: boolean; attuned: boolean; notes?: string }[]
    weight: number
    capacity: number
  }
}

/** Build the sheet shown to the players. `fighter` is the character's entry in a running fight (its HP and conditions are the live ones). */
export function toPublicSheet(c: Character, fighter: Combatant | undefined, opts: { inventory: boolean }): PublicSheet {
  const ch = normalizeCharacter(c)
  const pb = proficiencyBonus(ch.level)
  const casting = castingSnapshot(ch)
  const sc = ch.spellcasting
  const actions = resolveCharacterActions(ch)
  const dmg = (a: { damage?: string; damageType?: string }) => (a.damage ? `${a.damage}${a.damageType ? ` ${tDamage(a.damageType)}` : ''}` : '')
  const next = xpForNextLevel(ch.level)
  const byLevel = new Map<number, string[]>()
  for (const s of sc?.prepared ?? []) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s.name])
  return {
    id: ch.id!,
    name: ch.name,
    playerName: ch.playerName,
    classLine: `${tClass(ch.classIndex) ?? ch.className} ${ch.level}${ch.subclass ? ` (${ch.subclass})` : ''}`,
    level: ch.level,
    ac: fighter?.ac ?? ch.ac,
    hp: fighter?.hp ?? ch.currentHp,
    maxHp: fighter?.maxHp ?? ch.maxHp,
    tempHp: fighter?.tempHp ?? 0,
    speed: ch.speed,
    initiativeBonus: ch.initiativeBonus,
    passivePerception: ch.passivePerception,
    proficiencyBonus: pb,
    hitDie: `d${ch.hitDie}`,
    hitDiceLeft: hitDiceRemaining(ch),
    exhaustion: fighter?.exhaustion ?? ch.exhaustion ?? 0,
    deathSaves: fighter && fighter.hp === 0 ? fighter.deathSaves : undefined,
    concentrating: !!fighter?.concentrating,
    conditions: fighter?.conditions ?? [],
    abilities: ABILITIES.map((a) => {
      const proficient = ch.saveProficiencies.includes(a)
      const mod = abilityMod(ch.abilities[a])
      return { key: tAbility(a), score: ch.abilities[a], mod, save: mod + (proficient ? pb : 0), proficient }
    }),
    defences: { resistances: ch.resistances.map(tDamage), immunities: ch.immunities.map(tDamage), vulnerabilities: ch.vulnerabilities.map(tDamage) },
    attacks: actions.map((a) => ({
      name: a.name,
      detail:
        a.kind === 'attack'
          ? [t('sheet.toHit', { n: formatMod(a.attackBonus ?? 0) }), dmg(a)].filter(Boolean).join(', ')
          : a.kind === 'save'
            ? [t('sheet.dc', { n: a.saveDc ?? 10, abil: tAbility(a.saveAbility ?? 'dex') }), dmg(a)].filter(Boolean).join(', ')
            : a.kind === 'heal'
              ? t('sheet.heals', { x: a.damage ?? '' }).trim()
              : '',
    })),
    spellcasting:
      sc && casting
        ? {
            ability: tAbility(sc.ability),
            saveDc: casting.saveDc,
            attackBonus: casting.attackBonus,
            slots: sc.slots.map((s, i) => ({ level: i + 1, max: s.max, used: s.used })).filter((s) => s.max > 0),
            cantrips: sc.cantrips.map((s) => s.name),
            prepared: [...byLevel].sort((a, b) => a[0] - b[0]).map(([level, names]) => ({ level, names })),
          }
        : undefined,
    features: ch.resources.map((r) => ({ name: r.name, max: r.max, used: r.used })),
    inventory: opts.inventory
      ? {
          coins: { ...ch.coins },
          xp: ch.xp ?? 0,
          nextXp: next,
          items: (ch.items ?? []).filter((i) => i.qty > 0).map((i) => ({ name: i.name, qty: i.qty, equipped: !!i.equipped, attuned: !!i.attuned, notes: i.notes })),
          weight: carriedWeight(ch),
          capacity: carryingCapacity(ch),
        }
      : undefined,
  }
}
