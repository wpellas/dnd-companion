export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
export type Ability = (typeof ABILITIES)[number]
export type AbilityScores = Record<Ability, number>

// 2024 rules conditions
export const CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
] as const
export type Condition = (typeof CONDITIONS)[number]

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]

/** The 12 core classes (index = dnd5eapi.co class index). */
export const CLASSES = [
  { index: 'barbarian', name: 'Barbarian' },
  { index: 'bard', name: 'Bard' },
  { index: 'cleric', name: 'Cleric' },
  { index: 'druid', name: 'Druid' },
  { index: 'fighter', name: 'Fighter' },
  { index: 'monk', name: 'Monk' },
  { index: 'paladin', name: 'Paladin' },
  { index: 'ranger', name: 'Ranger' },
  { index: 'rogue', name: 'Rogue' },
  { index: 'sorcerer', name: 'Sorcerer' },
  { index: 'warlock', name: 'Warlock' },
  { index: 'wizard', name: 'Wizard' },
] as const
export type ClassIndex = (typeof CLASSES)[number]['index']

/**
 * 'other' = a spell or effect with no attack roll, save or healing we could read from it. It still spends the
 * slot and sets concentration; the DM applies any damage/effects with the row controls.
 */
export type ActionKind = 'attack' | 'save' | 'heal' | 'other'

/** Slots of one spell level. Spent slots are tracked on the character so they persist across fights and rests. */
export interface SlotState {
  max: number
  used: number
}

/** A spell a character has assigned; details are fetched/cached from the SRD API by `index`. */
export interface KnownSpell {
  index: string
  name: string
  level: number
}

export interface Spellcasting {
  ability: Ability
  /** index 0 = 1st-level slots ... index 8 = 9th-level */
  slots: SlotState[]
  cantripLimit: number
  preparedLimit: number
  cantrips: KnownSpell[]
  prepared: KnownSpell[]
  /** true: slot counts and limits follow the class table for the level; editing them by hand turns this off */
  auto: boolean
}

/**
 * How rests restore a limited-use feature:
 * - 'short': every use comes back on a short or long rest (Action Surge, Monk Focus Points)
 * - 'short-one': one use comes back on a short rest, all of them on a long rest (Rage, Second Wind, Channel Divinity)
 * - 'long': only a long rest restores it
 */
export type Recharge = 'short' | 'short-one' | 'long'

/** A limited-use class feature or item (Second Wind, Rage, Bardic Inspiration...) that rests restore. */
export interface Resource {
  id: string
  name: string
  max: number
  used: number
  recharge: Recharge
  /** Set when added from the official list (see data/classFeatures.ts) */
  featureId?: string
  /** From the official list and not hand-edited: max/recharge follow the character's level and ability scores */
  auto?: boolean
}

/** When in a turn an action is used (monster stat blocks list these separately). */
export type ActionTiming = 'action' | 'bonus' | 'reaction' | 'legendary'

/** One damage roll of a single type. */
export interface DamagePart {
  dice: string
  type: string
  /** Set for optional extras, e.g. "if the attack roll had Advantage"; the DM ticks them when they apply */
  note?: string
}

/** Something a creature can do to a target: an attack roll, a saving-throw effect, or healing. */
export interface Action {
  id: string
  name: string
  kind: ActionKind
  /** attack: to-hit bonus */
  attackBonus?: number
  /** save: ability the target saves with, the DC, and whether a success still takes half damage */
  saveAbility?: Ability
  saveDc?: number
  halfOnSave?: boolean
  /** The target picks which of these abilities to save with (Grapple, Shove: Strength or Dexterity); the app starts with the better bonus */
  saveChoice?: Ability[]
  /**
   * Characters only: when set, the numbers are derived from the character's stats at the time they join a
   * fight (see lib/character.ts) instead of using the flat `attackBonus` / `saveDc` / damage modifier.
   * For attacks this is the attack ability; for save/heal actions it's the spellcasting ability.
   */
  ability?: Ability
  /** Attacks: add the proficiency bonus to hit */
  proficient?: boolean
  /** Attacks: flat magic bonus, applied to both the attack and damage rolls (e.g. a +1 weapon) */
  magicBonus?: number
  /** Dice expression like "1d6+2" (damage, or the amount healed for kind 'heal') */
  damage?: string
  damageType?: string
  /** More damage of other types rolled alongside the main damage (e.g. slashing + fire); parts with a note are optional */
  extraDamage?: DamagePart[]
  /** Applied to the target on a hit / failed save */
  condition?: Condition
  range?: string
  /** Where it falls in the turn: used to tick off the bonus action / reaction tracker */
  timing?: ActionTiming
  /** Full rules text from a stat block, shown as a reminder for riders the app doesn't model */
  desc?: string
  /** Area of effect text, e.g. "60-foot Cone": a hint that several targets can be picked */
  area?: string
  /** Monsters: recharge on a d6 roll, N uses per day, or one use per rest */
  limited?: { kind: 'recharge'; min: number } | { kind: 'day'; times: number } | { kind: 'rest' }
  /** Attack actions that make several separate attacks (Scorching Ray, Magic Missile, Eldritch Blast): one roll per ray */
  volley?: { count: number; autoHit?: boolean }
  /** Multiattack: the attacks it makes, in order; each lists the actions of the creature it may be (usually just one) */
  multiattack?: { choices: string[] }[]
  /** 2024 Weapon Mastery property the wielder has unlocked with this weapon: its effect is shown when the attack lands */
  mastery?: string
  /** Characters: the inventory item (id) this attack spends one piece of per shot */
  ammoItem?: string
}

export const COIN_TYPES = ['pp', 'gp', 'ep', 'sp', 'cp'] as const
export type CoinType = (typeof COIN_TYPES)[number]
export type Coins = Record<CoinType, number>

export type ItemKind = 'weapon' | 'armor' | 'shield' | 'gear' | 'magic' | 'treasure'

/** How much of the Dexterity modifier body armor lets through. */
export type ArmorDex = 'full' | 'max2' | 'none'

/** Something a character carries. Weapons and armor take part in combat when equipped (see lib/inventory.ts). */
export interface Item {
  id: string
  name: string
  kind: ItemKind
  qty: number
  /** Pounds each */
  weight?: number
  /** What one is worth in gold pieces, a whole number. Only the "items are worth" counter uses it: it never touches the character's coins. */
  value?: number
  notes?: string
  /** Full text, for items picked from the SRD list */
  desc?: string
  /** Where it came from in the SRD list, so the picker can show what you already have */
  srd?: { source: 'equipment' | 'magic-items'; index: string }
  equipped?: boolean
  /** A wand, staff or ring with charges: pips in the fight and on the sheet; a long rest restores them when it regains all at dawn */
  charges?: { max: number; used: number; /** "all" = a long rest restores every charge; dice text ("1d6+1") = a reminder, you adjust by hand */ dawn?: string }
  requiresAttunement?: boolean
  attuned?: boolean
  /** Magic bonus: added to attack and damage rolls (weapons) or to Armor Class (armor and shields) */
  magicBonus?: number
  weapon?: {
    damage: string
    damageType: string
    /** Damage when wielded with two hands, for Versatile weapons */
    versatile?: string
    ranged?: boolean
    finesse?: boolean
    /** "80/320 ft." */
    range?: string
    /** 2024 weapon mastery property, kept as a reminder */
    mastery?: string
    /** The wielder has unlocked that mastery with this weapon (Weapon Mastery is chosen per weapon): only then is it offered in combat */
    masteryKnown?: boolean
    /** Uses ammunition (bows, crossbows, slings, blowguns): each attack spends one piece from the matching item (Arrows, Bolts...) or from `ammoId` */
    ammunition?: boolean
    /** The inventory item this weapon fires, when it is not the one found by name */
    ammoId?: string
    /** Is the character proficient with it? (adds the proficiency bonus to hit) */
    proficient: boolean
  }
  /** Armor: base AC; shield: the bonus it adds */
  armor?: { base: number; dex: ArmorDex }
}

export interface Character {
  id?: number
  name: string
  playerName: string
  /** The account that owns this character: whoever made it, or whoever the DM handed it to. The server decides; players edit only their own. */
  ownerId?: number
  /** 2024 Heroic Inspiration: the player may reroll one die and must use the new roll */
  heroicInspiration?: boolean
  classIndex?: ClassIndex
  /** Free text, e.g. "Battle Master" */
  subclass: string
  /** Legacy free-text class from before the dropdown; shown only if no classIndex is set */
  className: string
  level: number
  ac: number
  maxHp: number
  currentHp: number
  speed: number
  initiativeBonus: number
  passivePerception: number
  /** Passive Investigation and Insight (10 + bonus), for the DM's check sheet */
  passiveInvestigation?: number
  passiveInsight?: number
  abilities: AbilityScores
  /** Saving throws the character is proficient in (the class grants two) */
  saveProficiencies: Ability[]
  /** Damage types the character resists / is immune to / is vulnerable to (from race, items, features) */
  resistances: string[]
  immunities: string[]
  vulnerabilities: string[]
  actions: Action[]
  /** Hit die size (d6/d8/d10/d12) from the class; `hitDiceUsed` of `level` dice are spent */
  hitDie: number
  hitDiceUsed: number
  resources: Resource[]
  spellcasting?: Spellcasting
  /** Exhaustion level 0-6 (2024 rules); a long rest removes one */
  exhaustion?: number
  /** Experience points; the level they point to is shown next to the level the character is actually at */
  xp?: number
  coins?: Coins
  items?: Item[]
  /** Armor Class follows the equipped armor and shield (kept in `ac`); off = `ac` is typed by hand */
  acFromGear?: boolean
  image?: Blob
}

/** Spellcasting numbers snapshotted onto a PC when they join a fight (slots stay on the character). */
export interface CastingSnapshot {
  ability: Ability
  mod: number
  attackBonus: number
  saveDc: number
  casterLevel: number
}

/** A named trait with a counter, e.g. Legendary Resistance (3/day). */
export interface MonsterTrait {
  id: string
  name: string
  desc: string
  /** Limited uses per day, if any */
  uses?: number
}

/** A spell on a monster's Spellcasting list. `times` unset = at will; otherwise that many casts per day. */
export interface MonsterSpell {
  index: string
  name: string
  level: number
  times?: number
}

export interface MonsterTemplate {
  id?: number
  /** Set on templates built from the SRD API (the SRD library itself isn't stored in the monsters table) */
  srdIndex?: string
  name: string
  cr: string
  ac: number
  hp: number
  /** Dice for the hit points (SRD "3d6", or typed for a custom monster); `hp` is the average. Used when the setting "roll monster hit points" is on */
  hpRoll?: string
  speed: number
  initiativeBonus: number
  abilities: AbilityScores
  actions: Action[]
  source: 'srd' | 'custom'
  size?: string
  type?: string
  xp?: number
  /** XP when met in its lair (some legendary monsters) */
  xpLair?: number
  /** Total saving-throw bonuses for the saves the monster is proficient in; others use the ability modifier */
  saves?: Partial<Record<Ability, number>>
  resistances?: string[]
  immunities?: string[]
  vulnerabilities?: string[]
  conditionImmunities?: Condition[]
  traits?: MonsterTrait[]
  /** Legendary actions per round (3, or 4 in the lair) when the monster has any */
  legendaryUses?: number
  /** Spells from its Spellcasting action and the numbers they use */
  spells?: MonsterSpell[]
  casting?: CastingSnapshot
}

/** Per-turn economy trackers (reset at the start of the creature's own turn). */
export interface TurnUsed {
  action: boolean
  bonus: boolean
  reaction: boolean
  /** Feet moved this turn (tracked by hand: there is no map) */
  moved?: number
  /** Times it took the Dash action this turn */
  dashes?: number
  /** Took the Disengage action: moving away provokes no opportunity attacks */
  disengaged?: boolean
}

export interface Counter {
  id: string
  name: string
  max: number
  used: number
}

/**
 * Something that lasts for a while on a creature: a spell, a condition with a timer, a rider that ends on a successful save.
 * The timer counts down at `at` of `whose` turn (usually the caster's, since a minute is ten rounds of the caster's turns) and the effect
 * ends when it reaches 0; the condition it gave goes with it. `save`: the affected creature repeats it at its own turn; success ends the effect.
 */
export interface Effect {
  id: string
  name: string
  /** Applied to the creature while the effect lasts */
  condition?: Condition
  /** Rounds left; no timer when empty (it ends by a save, by concentration, or by hand) */
  rounds?: number
  at: 'start' | 'end'
  /** The combatant whose turn counts the rounds down */
  whose: string
  /** Added during `whose`'s own turn at 'end': that turn's end does not count */
  skip?: boolean
  save?: { ability: Ability; dc: number; at: 'start' | 'end' }
  /** The caster; with `concentration`, the effect ends when they lose concentration or go down */
  sourceId?: string
  concentration?: boolean
  /** Numbers the effect changes (AC, resistances, how others attack it, speed) */
  mods?: EffectMods
}

export interface EffectMods {
  ac?: number
  resist?: string[]
  /** Attack rolls against the creature have Advantage / Disadvantage */
  attackersAdvantage?: boolean
  attackersDisadvantage?: boolean
  speed?: 'double' | 'half'
  /** i18n key of a reminder shown on this creature's own attack rolls (Bless +1d4, Rage damage...) */
  note?: string
}

/** A Wild Shape (or similar) form: the beast's numbers replace the creature's until it leaves the form; `revert` is what comes back. */
export interface Form {
  name: string
  /** The beast's actions (kept so an undo can put them back) */
  actions: Action[]
  revert: {
    ac: number
    speed?: number
    actions: Action[]
    saves?: Record<Ability, number>
    resistances?: string[]
    immunities?: string[]
    vulnerabilities?: string[]
    conditionImmunities?: Condition[]
    casting?: CastingSnapshot
  }
}

export interface Combatant {
  id: string
  kind: 'pc' | 'monster' | 'lair'
  name: string
  /** Set for PCs so the portrait and HP write-back can be resolved. */
  characterId?: number
  initiative: number | null
  initiativeBonus: number
  ac: number
  /** DC of its Grapple and Shove: 8 + Strength modifier + Proficiency Bonus */
  unarmedDc?: number
  /** Walking Speed in feet (a snapshot, like AC) */
  speed?: number
  /** Wild Shape: the beast form the creature is in */
  form?: Form
  hp: number
  maxHp: number
  tempHp: number
  conditions: Condition[]
  concentrating: boolean
  deathSaves: { successes: number; failures: number }
  /** Snapshot of the creature's actions when it joined the fight. */
  actions: Action[]
  /** Spellcasters: PCs with spellcasting, and monsters with a Spellcasting action */
  casting?: CastingSnapshot
  /** Monsters: the spells it can cast (slots aren't used; per-day casts are counted in `spent`) */
  spells?: MonsterSpell[]
  /** Exhaustion level 0-6: -2 per level on every d20 test */
  exhaustion?: number
  /** Spells and conditions with a timer or a repeat save */
  effects?: Effect[]
  /** PCs: has Heroic Inspiration (a copy of the character's, kept in step by useFightSync) */
  inspired?: boolean
  /** Surprised creatures roll Initiative with Disadvantage; only matters before combat starts */
  surprised?: boolean
  /** Tie-break among equal initiatives (lower acts first); set when a turn is delayed. Defaults to minus the initiative bonus */
  tieRank?: number
  /** Total saving-throw bonus per ability (proficiency included) */
  saves?: Record<Ability, number>
  resistances?: string[]
  immunities?: string[]
  vulnerabilities?: string[]
  conditionImmunities?: Condition[]
  turn?: TurnUsed
  /** Legendary action uses this round (monsters) */
  legendary?: { max: number; used: number }
  /** Limited-use traits like Legendary Resistance */
  counters?: Counter[]
  /** Uses spent per action id: for recharge actions 1 means "needs a recharge roll" */
  spent?: Record<string, number>
  xp?: number
  /** Which template a monster came from, so a fight can be saved as an encounter */
  templateRef?: { srdIndex?: string; templateId?: number; name: string }
  /** A monster-type creature on the party's side (familiar, companion, summon, hired help): shown to the table like a PC, gives no XP */
  ally?: boolean
  /** An ally acts on its controller's initiative, right after them (id of a combatant) */
  controlledBy?: string
  /** Free text, used by the lair-actions marker */
  notes?: string
}

/** Something the DM has to resolve, shown as a banner above the fight until handled. */
export type Prompt =
  | { id: string; kind: 'concentration'; combatantId: string; dc: number }
  | { id: string; kind: 'recharge'; combatantId: string; actionId: string; min: number }
  | { id: string; kind: 'effectSave'; combatantId: string; effectId: string }

/** A line for the player view: safe to show the table (no monster HP / AC / roll details). */
export interface PublicEvent {
  id: string
  text: string
  at: number
  /** What the table display animates for this line. `amount` only for party targets, like the text. */
  fx?: PublicFx
}

export interface PublicFx {
  kind: 'hit' | 'crit' | 'miss' | 'saved' | 'damage' | 'heal'
  targetId: string
  amount?: number
}

/** What a combat state looks like inside an undo snapshot. */
export interface CombatSnapshot {
  combatants: Combatant[]
  round: number
  turnIndex: number
  started: boolean
  log: string[]
  prompts: Prompt[]
  events: PublicEvent[]
}

export interface HistoryEntry {
  label: string
  snapshot: CombatSnapshot
  /** Undoing a spell cast also hands this spell slot back */
  refund?: { characterId: number; level: number }
  /** Actions of combatants this change removed, so undoing it can bring them back whole */
  restoreActions?: Record<string, Action[]>
}

export interface CombatState {
  id: 'current'
  combatants: Combatant[]
  round: number
  turnIndex: number
  started: boolean
  /** Human-readable event history, newest last (capped). */
  log: string[]
  prompts?: Prompt[]
  /** Player-safe announcements, newest last (capped) */
  events?: PublicEvent[]
  /** Undo stack, newest last (capped) */
  history?: HistoryEntry[]
}

export interface EncounterEntry {
  /** SRD monster index, or a custom monster's id */
  srdIndex?: string
  templateId?: number
  name: string
  count: number
}

export interface Encounter {
  id?: number
  name: string
  notes: string
  entries: EncounterEntry[]
  /** A music scene or track to prepare as the combat music when the encounter is loaded ("scene:<id>" / "track:<id>", see lib/music.ts) */
  music?: string
}

/** A DM-only entry in the campaign journal: a note, a session recap, or an automatic combat summary. */
/** A battle map or other handout picture the DM can show to the players (see lib/maps.ts). Fog of war will hang off this record later. */
export interface MapRecord {
  id?: number
  name: string
  /** 'image' = a picture to show for storytelling (no fog of war ever); absent = a map */
  kind?: 'map' | 'image'
  image: Blob
  /** Transparent PNGs at the map's pixel size, stacked in order over `image` (fog of war, secret rooms). `on` = drawn on what the players see; it belongs to the map, so it survives showing / hiding it. */
  layers?: MapLayer[]
}

export interface MapLayer {
  id: string
  name: string
  image: Blob
  on: boolean
}

/** A picture for a kind of creature (see lib/avatars.ts) */
export interface Avatar {
  key: string
  image: Blob
}

export interface JournalEntry {
  id?: number
  kind: 'note' | 'session' | 'combat' | 'loot'
  title: string
  body: string
  /** In-world campaign day when it was written */
  day: number
  createdAt: number
  updatedAt: number
  pinned?: boolean
}

/** A torch, lantern or spell that burns while the campaign clock runs. */
export interface Light {
  id: string
  name: string
  /** Minutes of light left */
  left: number
  lit: boolean
  /** "20 ft", "60-ft cone": what the SRD says (shown as a reminder) */
  bright: string
  dim: string
}
