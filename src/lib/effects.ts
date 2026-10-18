import type { Ability, Combatant, Condition, Effect, EffectMods } from '../types'
import { possessive, t, tAbility, tCondition, tDamage, tn } from './i18n'
import { newId } from './id'

/**
 * Common spells with a duration, so the DM does not type the same numbers every fight. When a spell with one of these names applies its
 * condition in the turn panel (a failed save, a hit), the matching effect is created automatically. Spell names are the SRD's, so they stay English.
 * `ticks`: the spell counts down at the start of the CASTER's turn (a minute = 10 rounds), or at the end of the TARGET's turn.
 * `save`: the target repeats this saving throw at the end of each of its turns, against the caster's spell save DC.
 */
export interface EffectPreset {
  name: string
  rounds?: number
  condition?: Condition
  save?: Ability
  ticks: 'caster' | 'target'
  concentration?: boolean
  /** Counts at the start/end of the target's turn instead of the default (Shield: until the start of its next turn) */
  at?: 'start' | 'end'
  mods?: EffectMods
}

const PHYSICAL = ['bludgeoning', 'piercing', 'slashing']

export const PRESETS: EffectPreset[] = [
  { name: 'Bane', rounds: 10, ticks: 'caster', concentration: true, mods: { note: 'eff.note.bane' } },
  { name: 'Bless', rounds: 10, ticks: 'caster', concentration: true, mods: { note: 'eff.note.bless' } },
  { name: 'Blindness/Deafness', rounds: 10, condition: 'Blinded', save: 'con', ticks: 'caster' },
  { name: 'Blur', rounds: 10, ticks: 'caster', concentration: true, mods: { attackersDisadvantage: true } },
  { name: 'Cause Fear', rounds: 10, condition: 'Frightened', save: 'wis', ticks: 'caster', concentration: true },
  { name: 'Dodge', rounds: 1, at: 'start', ticks: 'target', mods: { attackersDisadvantage: true, note: 'eff.note.dodge' } },
  { name: 'Entangle', rounds: 10, condition: 'Restrained', ticks: 'caster', concentration: true },
  { name: 'Faerie Fire', rounds: 10, save: 'dex', ticks: 'caster', concentration: true, mods: { attackersAdvantage: true } },
  { name: 'Haste', rounds: 10, ticks: 'caster', concentration: true, mods: { ac: 2, speed: 'double', note: 'eff.note.haste' } },
  { name: 'Hold Monster', rounds: 10, condition: 'Paralyzed', save: 'wis', ticks: 'caster', concentration: true },
  { name: 'Hold Person', rounds: 10, condition: 'Paralyzed', save: 'wis', ticks: 'caster', concentration: true },
  { name: 'Invisibility', rounds: 600, condition: 'Invisible', ticks: 'caster', concentration: true },
  { name: 'Rage', rounds: 10, ticks: 'target', mods: { resist: PHYSICAL, note: 'eff.note.rage' } },
  { name: 'Shield', rounds: 1, at: 'start', ticks: 'target', mods: { ac: 5 } },
  { name: 'Shield of Faith', rounds: 100, ticks: 'caster', concentration: true, mods: { ac: 2 } },
  { name: 'Slow', rounds: 10, save: 'wis', ticks: 'caster', concentration: true, mods: { ac: -2, speed: 'half', note: 'eff.note.slow' } },
  { name: "Tasha's Hideous Laughter", rounds: 10, condition: 'Incapacitated', save: 'wis', ticks: 'caster', concentration: true },
]

export const presetFor = (name: string) => PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase())

/** The effect a preset makes on `target`. Without a caster the countdown falls back to the target's own turn, and nothing depends on concentration. */
export function effectFromPreset(p: EffectPreset, ctx: { targetId: string; casterId?: string; dc?: number }): Effect {
  const byCaster = p.ticks === 'caster' && !!ctx.casterId
  return {
    id: newId(),
    name: p.name,
    condition: p.condition,
    rounds: p.rounds,
    at: p.at ?? (byCaster ? 'start' : 'end'),
    whose: byCaster ? ctx.casterId! : ctx.targetId,
    save: p.save && ctx.dc ? { ability: p.save, dc: ctx.dc, at: 'end' } : undefined,
    sourceId: ctx.casterId,
    concentration: !!p.concentration && !!ctx.casterId,
    mods: p.mods,
  }
}

/** What an effect's numbers do, in words. */
export function modsLine(m?: EffectMods) {
  return [
    m?.ac ? t('eff.mod.ac', { n: m.ac > 0 ? `+${m.ac}` : String(m.ac) }) : '',
    m?.resist?.length ? t('eff.mod.resist', { types: m.resist.map(tDamage).join(', ') }) : '',
    m?.attackersAdvantage ? t('eff.mod.advantage') : '',
    m?.attackersDisadvantage ? t('eff.mod.disadvantage') : '',
    m?.speed ? t(m.speed === 'double' ? 'eff.mod.speedDouble' : 'eff.mod.speedHalf') : '',
    m?.note ? t(m.note as Parameters<typeof t>[0]) : '',
  ]
    .filter(Boolean)
    .join('; ')
}

/** One effect, in words: what it is, how long it has left, who counts it down, and its repeat save. */
export function effectLine(e: Effect, all: Pick<Combatant, 'id' | 'name'>[]) {
  const whose = all.find((c) => c.id === e.whose)
  return [
    modsLine(e.mods),
    e.condition ? tCondition(e.condition) : '',
    e.rounds !== undefined ? tn('eff.rounds', e.rounds) : '',
    e.rounds !== undefined && whose ? t(e.at === 'start' ? 'eff.tickStart' : 'eff.tickEnd', { whose: possessive(whose.name) }) : '',
    e.save ? t(e.save.at === 'start' ? 'eff.saveStart' : 'eff.saveEnd', { ability: tAbility(e.save.ability), dc: e.save.dc }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

