import { abilityMod } from '../lib/dice'
import { newId } from '../lib/id'
import type { Ability, AbilityScores, ClassIndex, Recharge, Resource } from '../types'

/**
 * Limited-use class features from the 2024 SRD 5.2, for the "add a feature" list on the character editor.
 *
 * Built from the official feature texts at https://www.dnd5eapi.co/api/2024/features: which features have a limited
 * number of uses, how many, when the feature unlocks and how rests recharge it. Use counts that come from a class
 * table column (Rage, Channel Divinity, Second Wind...) are read from the official class level table at runtime
 * (`table` below = that level's `class_specific` row), so they follow level-ups exactly; the rest are the formulas
 * stated in the feature text. Subclass features are listed under their subclass because subclass is free text on a
 * character. Features that aren't use-limited (Extra Attack, Sneak Attack...) deliberately aren't here.
 */
export interface FeatureCtx {
  level: number
  abilities: AbilityScores
  /** `class_specific` of the character's class level row from the SRD API, when available */
  table?: Record<string, unknown>
}

export interface FeatureTemplate {
  /** Stable id (matches the SRD feature index where one exists) */
  id: string
  classIndex: ClassIndex
  name: string
  /** Character level at which the feature unlocks */
  level: number
  /** Shown as a group heading instead of "Class features" */
  subclass?: string
  uses: (c: FeatureCtx) => number
  recharge: Recharge | ((c: FeatureCtx) => Recharge)
  /** Short reminder shown in the list */
  note?: string
}

const fromTable = (c: FeatureCtx, key: string, fallback: number) => {
  const v = c.table?.[key]
  return typeof v === 'number' && v > 0 ? v : fallback
}
const mod = (c: FeatureCtx, ability: Ability) => Math.max(1, abilityMod(c.abilities[ability])) // "(minimum of once)"
const once = () => 1

export const CLASS_FEATURES: FeatureTemplate[] = [
  // Barbarian
  { id: 'barbarian-rage', classIndex: 'barbarian', name: 'Rage', level: 1, uses: (c) => fromTable(c, 'rage_count', 2), recharge: 'short-one', note: 'Uses per the Rages column' },
  { id: 'barbarian-persistent-rage', classIndex: 'barbarian', name: 'Persistent Rage (regain Rage on initiative)', level: 15, uses: once, recharge: 'long' },
  { id: 'barbarian-intimidating-presence', classIndex: 'barbarian', name: 'Intimidating Presence', level: 14, subclass: 'Path of the Berserker', uses: once, recharge: 'long' },

  // Bard
  { id: 'bard-bardic-inspiration', classIndex: 'bard', name: 'Bardic Inspiration', level: 1, uses: (c) => mod(c, 'cha'), recharge: (c) => (c.level >= 5 ? 'short' : 'long'), note: 'Charisma modifier; short rest too from level 5' },

  // Cleric
  { id: 'cleric-channel-divinity', classIndex: 'cleric', name: 'Channel Divinity', level: 2, uses: (c) => fromTable(c, 'channel_divinity_charges', 2), recharge: 'short-one' },
  { id: 'cleric-divine-intervention', classIndex: 'cleric', name: 'Divine Intervention', level: 10, uses: once, recharge: 'long' },

  // Druid
  { id: 'druid-wild-shape', classIndex: 'druid', name: 'Wild Shape', level: 2, uses: (c) => fromTable(c, 'wild_shape_uses', 2), recharge: 'short-one' },
  { id: 'druid-natural-recovery-cast', classIndex: 'druid', name: 'Natural Recovery (free Circle spell)', level: 6, subclass: 'Circle of the Land', uses: once, recharge: 'long' },
  { id: 'druid-natural-recovery-slots', classIndex: 'druid', name: 'Natural Recovery (recover spell slots)', level: 6, subclass: 'Circle of the Land', uses: once, recharge: 'long' },

  // Fighter
  { id: 'fighter-second-wind', classIndex: 'fighter', name: 'Second Wind', level: 1, uses: (c) => fromTable(c, 'second_wind_uses', 2), recharge: 'short-one' },
  { id: 'fighter-action-surge', classIndex: 'fighter', name: 'Action Surge', level: 2, uses: (c) => (c.level >= 17 ? 2 : 1), recharge: 'short' },
  { id: 'fighter-indomitable', classIndex: 'fighter', name: 'Indomitable', level: 9, uses: (c) => (c.level >= 17 ? 3 : c.level >= 13 ? 2 : 1), recharge: 'long' },

  // Monk
  { id: 'monk-focus-points', classIndex: 'monk', name: 'Focus Points', level: 2, uses: (c) => fromTable(c, 'focus_points', c.level), recharge: 'short', note: 'Pool; Stunning Strike, Flurry of Blows and more spend them' },
  { id: 'monk-uncanny-metabolism', classIndex: 'monk', name: 'Uncanny Metabolism', level: 2, uses: once, recharge: 'long' },
  { id: 'monk-wholeness-of-body', classIndex: 'monk', name: 'Wholeness of Body', level: 6, subclass: 'Warrior of the Open Hand', uses: (c) => mod(c, 'wis'), recharge: 'long' },

  // Paladin
  { id: 'paladin-lay-on-hands', classIndex: 'paladin', name: 'Lay On Hands (HP pool)', level: 1, uses: (c) => c.level * 5, recharge: 'long', note: 'Pool of 5 × level Hit Points' },
  { id: 'paladin-paladins-smite', classIndex: 'paladin', name: "Paladin's Smite (free Divine Smite)", level: 2, uses: once, recharge: 'long' },
  { id: 'paladin-channel-divinity', classIndex: 'paladin', name: 'Channel Divinity', level: 3, uses: (c) => fromTable(c, 'channel_divinity_charges', 2), recharge: 'short-one' },
  { id: 'paladin-faithful-steed', classIndex: 'paladin', name: 'Faithful Steed (free Find Steed)', level: 5, uses: once, recharge: 'long' },
  { id: 'paladin-holy-nimbus', classIndex: 'paladin', name: 'Holy Nimbus', level: 20, subclass: 'Oath of Devotion', uses: once, recharge: 'long' },

  // Ranger
  { id: 'ranger-favored-enemy', classIndex: 'ranger', name: 'Favored Enemy (free Hunter’s Mark)', level: 1, uses: (c) => fromTable(c, 'favored_enemies', 2), recharge: 'long' },
  { id: 'ranger-tireless', classIndex: 'ranger', name: 'Tireless (temporary HP)', level: 10, uses: (c) => mod(c, 'wis'), recharge: 'long' },
  { id: 'ranger-natures-veil', classIndex: 'ranger', name: "Nature's Veil", level: 14, uses: (c) => mod(c, 'wis'), recharge: 'long' },

  // Rogue
  { id: 'rogue-stroke-of-luck', classIndex: 'rogue', name: 'Stroke of Luck', level: 20, uses: once, recharge: 'short' },

  // Sorcerer
  { id: 'sorcerer-innate-sorcery', classIndex: 'sorcerer', name: 'Innate Sorcery', level: 1, uses: () => 2, recharge: 'long' },
  { id: 'sorcerer-sorcery-points', classIndex: 'sorcerer', name: 'Sorcery Points', level: 2, uses: (c) => fromTable(c, 'sorcery_points', c.level), recharge: 'long', note: 'Pool; Font of Magic' },
  { id: 'sorcerer-sorcerous-restoration', classIndex: 'sorcerer', name: 'Sorcerous Restoration', level: 5, uses: once, recharge: 'long' },
  { id: 'sorcerer-dragon-wings', classIndex: 'sorcerer', name: 'Dragon Wings', level: 14, subclass: 'Draconic Sorcery', uses: once, recharge: 'long' },
  { id: 'sorcerer-dragon-companion', classIndex: 'sorcerer', name: 'Dragon Companion (free Summon Dragon)', level: 18, subclass: 'Draconic Sorcery', uses: once, recharge: 'long' },

  // Warlock
  { id: 'warlock-magical-cunning', classIndex: 'warlock', name: 'Magical Cunning', level: 2, uses: once, recharge: 'long' },
  { id: 'warlock-dark-ones-own-luck', classIndex: 'warlock', name: "Dark One's Own Luck", level: 6, subclass: 'Fiend Patron', uses: (c) => mod(c, 'cha'), recharge: 'long' },
  { id: 'warlock-contact-patron', classIndex: 'warlock', name: 'Contact Patron', level: 9, uses: once, recharge: 'long' },
  { id: 'warlock-mystic-arcanum', classIndex: 'warlock', name: 'Mystic Arcanum (free casts, 6th-9th level)', level: 11, uses: (c) => (c.level >= 17 ? 4 : c.level >= 15 ? 3 : c.level >= 13 ? 2 : 1), recharge: 'long', note: 'One free cast per Arcanum spell known' },
  { id: 'warlock-hurl-through-hell', classIndex: 'warlock', name: 'Hurl Through Hell', level: 14, subclass: 'Fiend Patron', uses: once, recharge: 'long' },

  // Wizard
  { id: 'wizard-arcane-recovery', classIndex: 'wizard', name: 'Arcane Recovery', level: 1, uses: once, recharge: 'long', note: 'Use on a short rest to recover spell slots' },
  { id: 'wizard-signature-spells', classIndex: 'wizard', name: 'Signature Spells (free casts)', level: 20, uses: () => 2, recharge: 'short' },
]

/** Features of a class the character has reached, class features first, then each subclass. */
export const featuresFor = (classIndex: ClassIndex | undefined, level: number) =>
  CLASS_FEATURES.filter((f) => f.classIndex === classIndex && f.level <= level)

export const featureById = (id: string | undefined) => CLASS_FEATURES.find((f) => f.id === id)

const rechargeOf = (f: FeatureTemplate, ctx: FeatureCtx): Recharge => (typeof f.recharge === 'function' ? f.recharge(ctx) : f.recharge)

/** A fresh, fully-available resource for a catalog feature at the character's current level. */
export const resourceFromFeature = (f: FeatureTemplate, ctx: FeatureCtx): Resource => ({
  id: newId(),
  name: f.name,
  max: Math.max(1, f.uses(ctx)),
  used: 0,
  recharge: rechargeOf(f, ctx),
  featureId: f.id,
  auto: true,
})

/**
 * Re-derive max uses and recharge for catalog features that haven't been hand-edited (after a level-up or an
 * ability score change). Returns the same array when nothing changed, so it's safe to call from an effect.
 */
export function refreshResources(resources: Resource[], ctx: FeatureCtx): Resource[] {
  let changed = false
  const next = resources.map((r) => {
    const f = featureById(r.featureId)
    if (!f || !r.auto) return r
    const max = Math.max(1, f.uses(ctx))
    const recharge = rechargeOf(f, ctx)
    if (max === r.max && recharge === r.recharge) return r
    changed = true
    return { ...r, max, recharge, used: Math.min(r.used, max) }
  })
  return changed ? next : resources
}
