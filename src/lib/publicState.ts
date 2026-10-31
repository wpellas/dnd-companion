import { ABILITIES, type Character, type Combatant, type CombatState, type Condition, type Item, type PublicEvent } from '../types'
import { hpStatus, type HpStatus } from './combat'
import { isParty } from './sides'
import { tokenCells, type FogCover } from './grid'
import { normalizeCharacter, proficiencyBonus, castingSnapshot, resolveCharacterActions } from './character'
import { abilityMod, formatMod } from './dice'
import { canLevelUp, carriedWeight, carryingCapacity, itemsGp, levelForXp, totalGp, XP_FOR_LEVEL, xpForNextLevel } from './inventory'
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
  /** On the party's side (an ally rather than an enemy) */
  ally?: boolean
  /** Player characters and allies only */
  hp?: number
  maxHp?: number
  tempHp?: number
  deathSaves?: { successes: number; failures: number }
  status: HpStatus
  conditions: Condition[]
  /** Exhaustion level 1-6, if any */
  exhaustion?: number
  concentrating: boolean
  /** Player characters with Heroic Inspiration */
  inspired?: boolean
  /** Wild Shape: the beast it has become */
  form?: string
  /** Spells and effects running on this creature; only player characters show how many rounds are left */
  effects?: { name: string; rounds?: number }[]
  /** Its token on the map being shown (only once the DM has placed it) and how many squares across it covers */
  pos?: Combatant['pos']
  cells?: number
}

export interface PublicCombat {
  combatants: PublicCombatant[]
  round: number
  turnIndex: number
  started: boolean
  events: PublicEvent[]
}

/** `cover` = the map being shown and its fogged squares: only tokens on that map go out, and an enemy's only while it is not under fog
 *  (no cover = no map shown = no positions at all). */
export function toPublic(s: CombatState | undefined, cover?: FogCover | null): PublicCombat | undefined {
  if (!s) return undefined
  const seen = (c: Combatant) => !!c.pos && !!cover && c.pos.map === cover.map && (isParty(c) || !cover.hides(c.pos, tokenCells(c.size)))
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
        form: c.form?.name,
        pos: seen(c) ? c.pos : undefined,
        cells: seen(c) && tokenCells(c.size) > 1 ? tokenCells(c.size) : undefined,
        effects: c.effects?.length ? c.effects.map((e) => ({ name: e.name, rounds: isParty(c) ? e.rounds : undefined })) : undefined,
      }
      return isParty(c) ? { ...base, ally: c.ally || undefined, hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp, deathSaves: c.hp === 0 ? c.deathSaves : undefined, inspired: c.inspired || undefined } : base
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
    /** What the coins are worth in whole gold pieces, and what the items are worth (a separate figure) */
    coinGp?: number
    itemsGp?: number
    xp: number
    /** XP where the current level starts, XP where the next begins, and that next level (for the progress bar) */
    xpFrom?: number
    nextXp?: number
    nextLevel?: number
    /** Set when the XP already says the character can level up */
    levelReady?: number
    items: { name: string; kind?: Item['kind']; qty: number; equipped: boolean; attuned: boolean; notes?: string; value?: number }[]
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
          coinGp: Math.floor(totalGp(ch.coins)),
          itemsGp: itemsGp(ch),
          xp: ch.xp ?? 0,
          xpFrom: XP_FOR_LEVEL[Math.min(20, Math.max(1, ch.level)) - 1],
          nextXp: next,
          nextLevel: next === undefined ? undefined : ch.level + 1,
          levelReady: canLevelUp(ch) ? levelForXp(ch.xp ?? 0) : undefined,
          items: (ch.items ?? []).filter((i) => i.qty > 0).map((i) => ({ name: i.name, kind: i.kind, qty: i.qty, equipped: !!i.equipped, attuned: !!i.attuned, notes: i.notes, value: i.value })),
          weight: carriedWeight(ch),
          capacity: carryingCapacity(ch),
        }
      : undefined,
  }
}
