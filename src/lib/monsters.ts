import { abilityMod } from './dice'
import type { SrdMonster, SrdMonsterAction } from './srdApi'
import {
  ABILITIES,
  CONDITIONS,
  DAMAGE_TYPES,
  type Ability,
  type Action,
  type ActionTiming,
  type Condition,
  type CastingSnapshot,
  type DamagePart,
  type MonsterSpell,
  type MonsterTemplate,
  type MonsterTrait,
} from '../types'

const FRACTIONS: Record<number, string> = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }
export const crLabel = (cr: number) => FRACTIONS[cr] ?? String(cr)

const isDamageType = (s: string): s is (typeof DAMAGE_TYPES)[number] => (DAMAGE_TYPES as readonly string[]).includes(s)

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Damage parts of a stat-block action. The API lists every damage roll but not *when* it applies, so the action text
 * is checked: a part followed by "if ..." (e.g. "if the attack roll had Advantage") or sitting inside a rider saving
 * throw is an optional extra and gets a note, which the DM ticks when it applies.
 */
export function parseDamageParts(a: SrdMonsterAction): DamagePart[] {
  const desc = a.desc.replace(/\s+/g, ' ')
  const riderAt = desc.search(/saving throw/i)
  return (a.damage ?? [])
    .filter((d) => d.damage_dice)
    .map((d, i): DamagePart => {
      const dice = d.damage_dice.replace(/\s/g, '')
      const type = d.damage_type?.index ?? ''
      if (i === 0) return { dice, type }
      // the roll as printed in the text: "(1d6 + 2)"
      const printed = new RegExp(`\\(\\s*${escapeRe(dice).replace(/\\?([+-])/g, '\\s*\\$1\\s*')}\\s*\\)`)
      const m = printed.exec(desc)
      if (!m) return { dice, type }
      const after = desc.slice(m.index + m[0].length).split(/[.(]/)[0]
      const cond = after.match(/\bif\b(.*)$/i)
      if (cond) return { dice, type, note: cond[1].trim() }
      if (riderAt >= 0 && m.index > riderAt && a.attack_bonus !== undefined) return { dice, type, note: RIDER_NOTE }
      return { dice, type }
    })
}

/** Note put on a damage part that only applies through a rider effect; shown translated (see `de.rider`). */
export const RIDER_NOTE = 'rider effect, see the action text'

const num = (s: string | undefined) => {
  const m = s?.match(/\d+/)
  return m ? Number(m[0]) : 0
}

function conditionIn(text: string): Condition | undefined {
  return CONDITIONS.find((c) => new RegExp(`\\b${c}\\b`).test(text))
}

/**
 * The attacks a Multiattack makes, one entry per attack, from the structured list ("Rend x2") plus the "choose one of"
 * extras some monsters have (the dragon's third attack is a Rend or a spell). The text is the fallback.
 */
export function parseMultiattack(a: SrdMonsterAction): { choices: string[] }[] | undefined {
  const rows: { choices: string[] }[] = []
  for (const x of a.actions ?? []) {
    for (let i = 0; i < (Number(x.count) || 1); i++) rows.push({ choices: [x.action_name] })
  }
  const opt = a.action_options
  if (opt?.from?.options?.length) {
    const names = [...new Set(opt.from.options.map((o) => o.action_name).filter((n): n is string => !!n))]
    for (let i = 0; i < (opt.choose || 1); i++) rows.push({ choices: names })
  }
  return rows.length ? rows : undefined
}

function toAction(a: SrdMonsterAction, timing: ActionTiming, prefix: string, spellText?: string): Action {
  const parts = parseDamageParts(a)
  const [main, ...extra] = parts
  const desc = a.desc.replace(/\s+\n/g, '\n').trim() + (spellText ? `\n${spellText}` : '')
  const base: Action = {
    id: `${prefix}:${a.name}`,
    name: a.name,
    kind: 'other',
    timing,
    desc,
    damage: main?.dice,
    damageType: main?.type || undefined,
    extraDamage: extra.length ? extra : undefined,
  }
  const range = a.desc.match(/\b(reach \d+ ft\.|range \d+(?:\/\d+)? ft\.)/i)?.[1]
  if (range) base.range = range
  const area = a.desc.match(/(\d+-foot(?:-radius)?[ -](?:Cone|Line|Sphere|Cube|Cylinder|Emanation|Hemisphere|[A-Z][a-z]+))/)?.[1]
  if (area) base.area = area

  if (a.attack_bonus !== undefined) {
    base.kind = 'attack'
    base.attackBonus = a.attack_bonus
  } else if (a.dc) {
    base.kind = 'save'
    const ability = a.dc.dc_type.index as Ability
    if ((ABILITIES as readonly string[]).includes(ability)) base.saveAbility = ability
    base.saveDc = a.dc.dc_value
    base.halfOnSave = a.dc.success_type === 'half'
    // a condition inflicted on a failed save: look only at the text after "Failure:"
    const failure = a.desc.match(/Failure:([\s\S]*?)(?:Success:|$)/)?.[1]
    const cond = failure ? conditionIn(failure) : undefined
    if (cond) base.condition = cond
  }

  if (a.name === 'Multiattack') base.multiattack = parseMultiattack(a)

  const u = a.usage
  if (u?.type === 'recharge on roll' && u.min_value) base.limited = { kind: 'recharge', min: u.min_value }
  else if (u?.type === 'per day' && u.times) base.limited = { kind: 'day', times: u.times }
  else if (u?.type === 'recharge after rest') base.limited = { kind: 'rest' }
  return base
}

/** "At will: Command, Detect Magic; 1/day each: Fireball" from a Spellcasting action, appended to its text. */
function spellListText(a: SrdMonsterAction & { spellcasting?: { spells?: { name: string; usage?: { type: string; times?: number } }[] } }) {
  const spells = a.spellcasting?.spells
  if (!spells?.length) return undefined
  const groups = new Map<string, string[]>()
  for (const s of spells) {
    const label = s.usage?.type === 'per day' ? `${s.usage.times}/day` : (s.usage?.type ?? 'other')
    groups.set(label, [...(groups.get(label) ?? []), s.name])
  }
  return 'Spells - ' + [...groups].map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')
}

/** The spells and numbers from a monster's Spellcasting action(s). Slots aren't tracked: casts are at will or N per day. */
function parseSpellcasting(m: SrdMonster, abilities: MonsterTemplate['abilities']): { spells?: MonsterSpell[]; casting?: CastingSnapshot } {
  const spells: MonsterSpell[] = []
  let casting: CastingSnapshot | undefined
  for (const a of m.actions) {
    const sc = a.spellcasting
    if (!sc) continue
    const ability = (ABILITIES as readonly string[]).includes(sc.ability.index) ? (sc.ability.index as Ability) : 'int'
    const mod = abilityMod(abilities[ability])
    const dc = sc.dc ?? 10
    casting ??= { ability, mod, saveDc: dc, attackBonus: sc.modifier ?? dc - 8, casterLevel: Math.max(1, Math.round(m.challenge_rating)) }
    for (const s of sc.spells ?? []) {
      if (spells.some((x) => x.index === s.index)) continue
      spells.push({ index: s.index, name: s.name, level: s.level, times: s.usage?.type === 'per day' ? s.usage.times : undefined })
    }
  }
  return { spells: spells.length ? spells : undefined, casting }
}

/** Resistances etc. come as lowercase damage-type words; ignore the odd free-text entries. */
const damageTypes = (list: string[]) => list.map((s) => s.toLowerCase().trim()).filter(isDamageType)

/** Build one of our monster templates from an SRD API monster. */
export function srdToTemplate(m: SrdMonster): MonsterTemplate {
  const abilities = { str: m.strength, dex: m.dexterity, con: m.constitution, int: m.intelligence, wis: m.wisdom, cha: m.charisma }
  const saves: Partial<Record<Ability, number>> = {}
  for (const p of m.proficiencies) {
    const key = p.proficiency.index.replace('saving-throw-', '')
    if (p.proficiency.index.startsWith('saving-throw-') && (ABILITIES as readonly string[]).includes(key)) saves[key as Ability] = p.value
  }
  const traits: MonsterTrait[] = m.special_abilities.map((t) => ({
    id: `trait:${t.name}`,
    name: t.name,
    desc: t.desc,
    uses: t.usage?.type === 'per day' ? t.usage.times : undefined,
  }))
  const actions = [
    ...m.actions.map((a) => toAction(a, 'action', 'a', spellListText(a as never))),
    ...m.bonus_actions.map((a) => toAction(a, 'bonus', 'b')),
    ...m.reactions.map((a) => toAction(a, 'reaction', 'r')),
    ...m.legendary_actions.map((a) => toAction(a, 'legendary', 'l')),
  ]
  return {
    srdIndex: m.index,
    name: m.name,
    cr: crLabel(m.challenge_rating),
    ac: m.armor_class[0]?.value ?? 10,
    hp: m.hit_points,
    speed: num(m.speed.walk ?? Object.values(m.speed)[0]),
    initiativeBonus: abilityMod(m.dexterity),
    abilities,
    actions,
    source: 'srd',
    size: m.size,
    type: m.type,
    xp: m.xp,
    xpLair: m.xp_in_lair,
    saves: Object.keys(saves).length ? saves : undefined,
    resistances: damageTypes(m.damage_resistances),
    immunities: damageTypes(m.damage_immunities),
    vulnerabilities: damageTypes(m.damage_vulnerabilities),
    conditionImmunities: m.condition_immunities
      .map((c) => CONDITIONS.find((k) => k.toLowerCase() === c.index))
      .filter((c): c is Condition => !!c),
    traits,
    legendaryUses: m.legendary_actions.length ? 3 : undefined,
    ...parseSpellcasting(m, abilities),
  }
}

/** Numeric challenge rating from a template's label ("1/4" -> 0.25), for sorting and filtering. */
export const crValue = (label: string) => {
  const [a, b] = label.split('/')
  return b ? Number(a) / Number(b) : Number(a)
}
