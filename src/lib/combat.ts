import { db } from '../db'
import type {
  Action,
  Character,
  Combatant,
  CombatSnapshot,
  CombatState,
  Condition,
  Counter,
  MonsterTemplate,
  TurnUsed,
} from '../types'
import { XP_BY_CR } from '../data/encounterBudget'
import { castingSnapshot, proficiencyBonus, resolveCharacterActions } from './character'
import { exhaustionLevel } from './conditionRules'
import { rollInitiative } from './dice'
import { addCombatSummary } from './journal'
import { buildSaves, isConditionImmune, type DamageAmount } from './resolve'
import { concentrationDc } from './rules'

const EMPTY: CombatState = { id: 'current', combatants: [], round: 0, turnIndex: 0, started: false, log: [], prompts: [], events: [], history: [] }

const HISTORY_LIMIT = 25
const newId = () => crypto.randomUUID()
const freshTurn = (): TurnUsed => ({ action: false, bonus: false, reaction: false })

/* ------------------------------------------------------------------------------------------------------------ */
/* Persistence, history and undo                                                                                 */
/* ------------------------------------------------------------------------------------------------------------ */

/** Optional extra info a mutation can hand back for the undo history. */
export interface MutationMeta {
  label?: string
  /** Undoing this also gives a spell slot back to a character */
  refund?: { characterId: number; level: number }
}

function normalize(s: CombatState): CombatState {
  s.log ??= []
  s.prompts ??= []
  s.events ??= []
  s.history ??= []
  return s
}

/** The undo-relevant part of a state. Actions are left out (they never change mid-fight) to keep entries small. */
const snapshotOf = (s: CombatState): CombatSnapshot =>
  // deep copy: a shallow one shares nested objects (conditions, turn trackers...) with the live state, so a later
  // in-place edit would silently rewrite the snapshot and undo would restore the *changed* values
  structuredClone({
    combatants: s.combatants.map((c) => ({ ...c, actions: [] })),
    round: s.round,
    turnIndex: s.turnIndex,
    started: s.started,
    log: s.log,
    prompts: s.prompts ?? [],
    events: s.events ?? [],
  })

/**
 * Read-modify-write the single combat record, recording an undo step. Dexie's liveQuery propagates the change to
 * every open tab, which is what keeps the second-window player view in sync. `fn` may return a `MutationMeta`.
 */
export async function mutateCombat(fn: (state: CombatState) => void | MutationMeta, label?: string) {
  await db.transaction('rw', db.combat, async () => {
    const state = normalize(structuredClone((await db.combat.get('current')) ?? EMPTY))
    const before = snapshotOf(state)
    const beforeJson = JSON.stringify(before)
    const beforeActions = new Map(state.combatants.map((c) => [c.id, c.actions]))
    const logLength = state.log.length
    const meta = fn(state) || {}
    const after = snapshotOf(state)
    if (JSON.stringify(after) !== beforeJson) {
      const afterIds = new Set(state.combatants.map((c) => c.id))
      const removed = [...beforeActions].filter(([id]) => !afterIds.has(id))
      state.history!.push({
        label: meta.label ?? label ?? (state.log.length > logLength ? state.log[state.log.length - 1] : 'last change'),
        snapshot: before,
        refund: meta.refund,
        restoreActions: removed.length ? Object.fromEntries(removed) : undefined,
      })
      if (state.history!.length > HISTORY_LIMIT) state.history!.splice(0, state.history!.length - HISTORY_LIMIT)
    }
    await db.combat.put(state)
  })
}

/** Undo the last combat change (and hand back a spell slot if the change was a cast). Returns what was undone. */
export async function undoCombat(): Promise<string | undefined> {
  let label: string | undefined
  await db.transaction('rw', db.combat, db.characters, async () => {
    const state = await db.combat.get('current')
    const entry = state?.history?.pop()
    if (!state || !entry) return
    const current = new Map(state.combatants.map((c) => [c.id, c.actions]))
    state.combatants = entry.snapshot.combatants.map((c) => ({ ...c, actions: current.get(c.id) ?? entry.restoreActions?.[c.id] ?? [] }))
    state.round = entry.snapshot.round
    state.turnIndex = entry.snapshot.turnIndex
    state.started = entry.snapshot.started
    state.log = entry.snapshot.log
    state.prompts = entry.snapshot.prompts
    state.events = entry.snapshot.events
    if (entry.refund) {
      const ch = await db.characters.get(entry.refund.characterId)
      const slot = ch?.spellcasting?.slots[entry.refund.level - 1]
      if (ch?.spellcasting && slot && slot.used > 0) {
        slot.used -= 1
        await db.characters.put(ch)
      }
    }
    await db.combat.put(state)
    label = entry.label
  })
  return label
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Creating combatants                                                                                           */
/* ------------------------------------------------------------------------------------------------------------ */

export function pcCombatant(c: Character): Combatant {
  return {
    id: newId(),
    kind: 'pc',
    name: c.name,
    characterId: c.id,
    initiative: null,
    initiativeBonus: c.initiativeBonus,
    ac: c.ac,
    hp: c.currentHp,
    maxHp: c.maxHp,
    tempHp: 0,
    conditions: c.exhaustion ? ['Exhaustion'] : [],
    concentrating: false,
    deathSaves: { successes: 0, failures: 0 },
    actions: resolveCharacterActions(c),
    casting: castingSnapshot(c),
    saves: buildSaves(c.abilities, { proficient: c.saveProficiencies ?? [], proficiencyBonus: proficiencyBonus(c.level) }),
    resistances: c.resistances ?? [],
    immunities: c.immunities ?? [],
    vulnerabilities: c.vulnerabilities ?? [],
    turn: freshTurn(),
    exhaustion: c.exhaustion ?? 0,
  }
}

export function monsterCombatants(t: MonsterTemplate, count: number, existing: Combatant[]): Combatant[] {
  const sameBase = existing.filter((c) => c.kind === 'monster' && (c.name === t.name || c.name.startsWith(`${t.name} `)))
  const numbered = count > 1 || sameBase.length > 0
  return Array.from({ length: count }, (_, i): Combatant => {
    const counters: Counter[] = (t.traits ?? []).filter((x) => x.uses).map((x) => ({ id: x.id, name: x.name, max: x.uses!, used: 0 }))
    return {
      id: newId(),
      kind: 'monster',
      name: numbered ? `${t.name} ${sameBase.length + i + 1}` : t.name,
      initiative: null,
      initiativeBonus: t.initiativeBonus,
      ac: t.ac,
      hp: t.hp,
      maxHp: t.hp,
      tempHp: 0,
      conditions: [],
      concentrating: false,
      deathSaves: { successes: 0, failures: 0 },
      actions: structuredClone(t.actions ?? []),
      saves: buildSaves(t.abilities, { totals: t.saves }),
      resistances: t.resistances ?? [],
      immunities: t.immunities ?? [],
      vulnerabilities: t.vulnerabilities ?? [],
      conditionImmunities: t.conditionImmunities ?? [],
      turn: freshTurn(),
      casting: t.casting,
      spells: t.spells?.length ? structuredClone(t.spells) : undefined,
      legendary: t.legendaryUses ? { max: t.legendaryUses, used: 0 } : undefined,
      counters: counters.length ? counters : undefined,
      spent: {},
      xp: t.xp ?? XP_BY_CR[t.cr],
      templateRef: { srdIndex: t.srdIndex, templateId: t.id, name: t.name },
    }
  })
}

/** The "lair actions on initiative count 20" marker. It loses initiative ties, as in the rules. */
export function lairCombatant(): Combatant {
  return {
    id: newId(),
    kind: 'lair',
    name: 'Lair actions',
    initiative: 20,
    initiativeBonus: -1000,
    ac: 0,
    hp: 0,
    maxHp: 0,
    tempHp: 0,
    conditions: [],
    concentrating: false,
    deathSaves: { successes: 0, failures: 0 },
    actions: [],
    notes: '',
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Log, public events, prompts                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

export function logEvent(s: CombatState, text: string) {
  s.log.push(text)
  if (s.log.length > 100) s.log.splice(0, s.log.length - 100)
}

/** A line the player view may show: no monster HP, AC or roll details. */
export function announce(s: CombatState, text: string) {
  s.events ??= []
  s.events.push({ id: newId(), text, at: Date.now() })
  if (s.events.length > 12) s.events.splice(0, s.events.length - 12)
}

type NewPrompt =
  | { kind: 'concentration'; combatantId: string; dc: number }
  | { kind: 'recharge'; combatantId: string; actionId: string; min: number }

/** Queue something for the DM to resolve. A second concentration check for the same creature keeps the higher DC. */
export function addPrompt(s: CombatState, prompt: NewPrompt) {
  s.prompts ??= []
  const dup = s.prompts.find((p) => {
    if (p.kind !== prompt.kind || p.combatantId !== prompt.combatantId) return false
    return p.kind === 'recharge' && prompt.kind === 'recharge' ? p.actionId === prompt.actionId : true
  })
  if (dup) {
    if (dup.kind === 'concentration' && prompt.kind === 'concentration') dup.dc = Math.max(dup.dc, prompt.dc)
    return
  }
  s.prompts.push({ ...prompt, id: newId() })
}

/** Concentration check settled: on a failure the creature loses concentration. */
export function settleConcentration(s: CombatState, promptId: string, success: boolean) {
  const p = s.prompts?.find((x) => x.id === promptId)
  if (!p || p.kind !== 'concentration') return
  const c = s.combatants.find((x) => x.id === p.combatantId)
  s.prompts = s.prompts!.filter((x) => x.id !== promptId)
  if (!c) return
  if (success) {
    logEvent(s, `${c.name} keeps concentrating (DC ${p.dc})`)
  } else {
    c.concentrating = false
    logEvent(s, `${c.name} fails the concentration save (DC ${p.dc}) and loses concentration`)
    announce(s, `${c.name} loses concentration`)
  }
}

/** Recharge roll made for a monster's action (5-6 etc.). */
export function settleRecharge(s: CombatState, promptId: string, roll: number) {
  const p = s.prompts?.find((x) => x.id === promptId)
  if (!p || p.kind !== 'recharge') return
  const c = s.combatants.find((x) => x.id === p.combatantId)
  s.prompts = s.prompts!.filter((x) => x.id !== promptId)
  const action = c?.actions.find((a) => a.id === p.actionId)
  if (!c || !action) return
  if (roll >= p.min) {
    delete c.spent?.[action.id]
    logEvent(s, `${c.name}'s ${action.name} recharges (rolled ${roll})`)
  } else {
    logEvent(s, `${c.name}'s ${action.name} stays spent (rolled ${roll}, needs ${p.min}+)`)
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Turn order                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

/** Where a creature sits among equal initiatives: lower acts first. A delayed turn sets this by hand; otherwise the bonus decides. */
const tieRankOf = (c: Combatant) => c.tieRank ?? -c.initiativeBonus

/** Sort by initiative (desc), ties broken by bonus (or by hand after a delay), keeping the active combatant active. */
export function sortCombatants(s: CombatState) {
  const currentId = s.combatants[s.turnIndex]?.id
  s.combatants.sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) || tieRankOf(a) - tieRankOf(b))
  const idx = s.combatants.findIndex((c) => c.id === currentId)
  s.turnIndex = idx === -1 ? 0 : idx
}

/** Defeated monsters are out of the turn order; PCs at 0 HP stay in for death saves; the lair marker never goes down. */
export const isDown = (c: Combatant) => c.kind !== 'lair' && c.hp === 0

/** Start-of-turn bookkeeping: economy trackers and legendary actions reset, spent recharge actions ask for a roll. */
function beginTurn(s: CombatState, c: Combatant) {
  c.turn = freshTurn()
  if (c.legendary) c.legendary.used = 0
  for (const a of c.actions ?? []) {
    if (a.limited?.kind === 'recharge' && c.spent?.[a.id]) addPrompt(s, { kind: 'recharge', combatantId: c.id, actionId: a.id, min: a.limited.min })
  }
}

export function startCombat(s: CombatState) {
  s.combatants.forEach((c) => {
    c.initiative ??= 0
    delete c.surprised // it only affects the initiative roll
  })
  s.turnIndex = 0
  sortCombatants(s)
  s.started = true
  s.round = 1
  if (s.combatants[0] && s.combatants[0].kind === 'monster' && isDown(s.combatants[0])) advanceTurn(s)
  else if (s.combatants[0]) beginTurn(s, s.combatants[0])
  logEvent(s, 'Combat begins')
}

/** Move to the next turn, skipping defeated monsters. */
export function advanceTurn(s: CombatState) {
  const n = s.combatants.length
  for (let i = 0; i < n; i++) {
    s.turnIndex++
    if (s.turnIndex >= n) {
      s.turnIndex = 0
      s.round++
    }
    const c = s.combatants[s.turnIndex]
    if (!(c.kind === 'monster' && isDown(c))) {
      beginTurn(s, c)
      return
    }
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Damage, healing, death                                                                                        */
/* ------------------------------------------------------------------------------------------------------------ */

export function applyDamage(c: Combatant, amount: number) {
  const absorbed = Math.min(c.tempHp, amount)
  c.tempHp -= absorbed
  c.hp = Math.max(0, c.hp - (amount - absorbed))
}

export function applyHealing(c: Combatant, amount: number) {
  if (amount <= 0) return
  c.hp = Math.min(c.maxHp, c.hp + amount)
  if (c.hp > 0) c.deathSaves = { successes: 0, failures: 0 }
}

const addCondition = (c: Combatant, cond: Condition) => {
  if (!c.conditions.includes(cond)) c.conditions.push(cond)
}

export interface DamageReport {
  total: number
  /** Notes for the DM log */
  notes: string[]
  /** What the table may be told, e.g. "falls unconscious" */
  publicNote?: string
}

/**
 * Deal damage to a combatant, applying the rules around it: temporary HP first, death-save failures for a PC already
 * at 0 HP (two on a crit), dropping to 0 (PCs fall Unconscious, instant death if the overflow reaches their maximum
 * HP, monsters are defeated) and a concentration check prompt when a concentrating creature stays up.
 * `parts` must already be adjusted for resistances and saves.
 */
export function dealDamage(s: CombatState, target: Combatant, parts: DamageAmount[], crit: boolean): DamageReport {
  const total = parts.reduce((n, p) => n + p.amount, 0)
  const notes: string[] = []
  if (total <= 0) return { total: 0, notes }

  if (target.kind === 'pc' && target.hp === 0) {
    target.deathSaves.failures = Math.min(3, target.deathSaves.failures + (crit ? 2 : 1))
    notes.push(`death save failure${crit ? 's (crit)' : ''} (${target.deathSaves.failures}/3)`)
    if (target.deathSaves.failures >= 3) {
      notes.push('has died')
      return { total, notes, publicNote: `${target.name} has died` }
    }
    return { total, notes }
  }

  const hpBefore = target.hp
  const absorbed = Math.min(target.tempHp, total)
  applyDamage(target, total)
  if (target.hp === 0) {
    target.concentrating = false
    // a creature that is down can't be concentrating, so a pending check is moot
    s.prompts = (s.prompts ?? []).filter((p) => !(p.kind === 'concentration' && p.combatantId === target.id))
    const overflow = total - absorbed - hpBefore
    if (target.kind === 'pc') {
      addCondition(target, 'Unconscious')
      if (overflow >= target.maxHp) {
        target.deathSaves.failures = 3
        notes.push('is killed outright (massive damage)')
        return { total, notes, publicNote: `${target.name} has died` }
      }
      notes.push('drops to 0 HP and falls Unconscious')
      return { total, notes, publicNote: `${target.name} falls unconscious` }
    }
    notes.push('is defeated')
    return { total, notes, publicNote: `${target.name} is defeated` }
  }
  if (target.concentrating) {
    const dc = concentrationDc(total)
    addPrompt(s, { kind: 'concentration', combatantId: target.id, dc })
    notes.push(`concentration save DC ${dc}`)
  }
  return { total, notes }
}

/** Heal a combatant. A PC brought back from 0 HP regains consciousness and clears their death saves. */
export function healTarget(target: Combatant, amount: number): string[] {
  const wasDown = target.hp === 0
  applyHealing(target, amount)
  if (wasDown && target.hp > 0 && target.kind === 'pc') {
    target.conditions = target.conditions.filter((c) => c !== 'Unconscious')
    return ['regains consciousness']
  }
  return []
}

/** The row's Dmg button: damage with no type, logged as a manual adjustment. */
export function damageRow(s: CombatState, c: Combatant, amount: number) {
  const r = dealDamage(s, c, [{ type: '', amount }], false)
  logEvent(s, `${c.name} takes ${amount} damage${r.notes.length ? ` - ${r.notes.join('; ')}` : ''}`)
  if (r.publicNote) announce(s, r.publicNote)
}

export function healRow(s: CombatState, c: Combatant, amount: number) {
  const notes = healTarget(c, amount)
  logEvent(s, `${c.name} is healed for ${amount}${notes.length ? ` - ${notes.join('; ')}` : ''}`)
  if (notes.length) announce(s, `${c.name} regains consciousness`)
}

/** Set a death-save pip count by hand, noting when it settles the character's fate. */
export function setDeathSaves(s: CombatState, c: Combatant, which: 'successes' | 'failures', n: number) {
  c.deathSaves[which] = n
  if (which === 'failures' && n >= 3) {
    logEvent(s, `${c.name} fails their third death save and dies`)
    announce(s, `${c.name} has died`)
  } else if (which === 'successes' && n >= 3) {
    logEvent(s, `${c.name} succeeds three death saves and is stable at 0 HP`)
    announce(s, `${c.name} is stable`)
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Resolving an action against its targets                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

export interface TargetOutcome {
  targetId: string
  result: 'miss' | 'hit' | 'crit' | 'saved' | 'failed' | 'heal' | 'cast'
  /** Damage by type (or healing as a single part), already adjusted for saves and resistances */
  parts: DamageAmount[]
  applyCondition: boolean
  /** How it was rolled, shown in the log: "d20 14 +4 = 18 vs AC 15" */
  detail?: string
  /** Resistance / immunity notes for the log */
  notes?: string[]
  /** Id of a counter on the target (Legendary Resistance) to spend: a failed save was turned into a success */
  spendCounter?: string
  /** For attacks inside a Multiattack or a volley of rays: the attack actually made, used for its name and condition */
  action?: Action
}

export interface ActionResolution {
  attackerId: string
  action: Action
  targets: TargetOutcome[]
  /** Set when the action is a spell: slot level spent (0 = cantrip / free), whether a slot was actually spent, and concentration */
  cast?: { slotLevel: number; spent: boolean; concentration: boolean; monsterSpell?: { index: string; times?: number } }
  /** Extra text for the log shared by every target (e.g. the damage roll) */
  detail?: string
}

const fmtParts = (parts: DamageAmount[]) => {
  const shown = parts.filter((p) => p.amount > 0)
  return shown.length ? shown.map((p) => `${p.amount}${p.type ? ` ${p.type}` : ''}`).join(' + ') : ''
}

/** Applies an already-resolved action to its targets and records it in the log and the player announcements. */
export function applyResolution(s: CombatState, r: ActionResolution): MutationMeta | void {
  {
    const attacker = s.combatants.find((c) => c.id === r.attackerId)
    if (!attacker) return
    const lines: string[] = []
    const publicLines: string[] = []

    for (const o of r.targets) {
      const target = s.combatants.find((c) => c.id === o.targetId)
      if (!target) continue
      const action = o.action ?? r.action
      const notes: string[] = [...(o.notes ?? [])]
      const total = o.parts.reduce((n, p) => n + p.amount, 0)
      const dmgText = fmtParts(o.parts)
      let line: string
      let pub: string
      let report: DamageReport | undefined

      if (o.result === 'cast') {
        line = `${attacker.name} casts ${action.name} on ${target.name}`
        pub = `${attacker.name} casts ${action.name}`
      } else if (o.result === 'heal') {
        notes.push(...healTarget(target, total))
        line = `${attacker.name} heals ${target.name} for ${total} (${action.name})`
        pub = target.kind === 'pc' ? `${attacker.name} heals ${target.name} for ${total}` : `${attacker.name} heals ${target.name}`
      } else if (o.result === 'miss') {
        line = `${attacker.name} misses ${target.name} (${action.name})`
        pub = `${attacker.name} misses ${target.name}`
      } else {
        report = dealDamage(s, target, o.parts, o.result === 'crit')
        notes.push(...report.notes)
        const verb = o.result === 'crit' ? 'CRITS' : 'hits'
        if (o.result === 'saved' || o.result === 'failed') {
          line = `${target.name} ${o.result === 'saved' ? 'saves against' : 'fails the save against'} ${attacker.name}'s ${action.name}, ${dmgText ? `takes ${dmgText}` : 'takes no damage'}`
          pub = `${target.name} ${o.result === 'saved' ? 'resists' : 'is caught by'} ${attacker.name}'s ${action.name}${target.kind === 'pc' && total > 0 ? ` (${total} damage)` : ''}`
        } else {
          line = `${attacker.name} ${verb} ${target.name} with ${action.name} for ${dmgText || '0'}`
          pub = `${attacker.name} ${o.result === 'crit' ? 'critically hits' : 'hits'} ${target.name}${target.kind === 'pc' && total > 0 ? ` for ${total}` : ''}`
        }
      }

      if (o.spendCounter) {
        const k = target.counters?.find((x) => x.id === o.spendCounter)
        if (k) {
          k.used = Math.min(k.max, k.used + 1)
          notes.push(`${k.name} (${k.max - k.used} left)`)
        }
      }
      const cond = action.condition
      const afflicted = o.result === 'hit' || o.result === 'crit' || o.result === 'failed'
      if (cond && o.applyCondition && afflicted) {
        if (isConditionImmune(target, cond)) notes.push(`immune to ${cond}`)
        else if (!target.conditions.includes(cond)) {
          target.conditions.push(cond)
          notes.push(`now ${cond}`)
        }
      }
      if (o.detail) notes.unshift(o.detail)
      lines.push(notes.length ? `${line} - ${notes.join('; ')}` : line)
      publicLines.push(pub)
      if (report?.publicNote) publicLines.push(report.publicNote)
    }

    const extra: string[] = []
    if (r.cast) {
      if (r.cast.spent && r.cast.slotLevel > 0) extra.push(`level ${r.cast.slotLevel} slot`)
      if (r.cast.monsterSpell?.times) {
        attacker.spent ??= {}
        const key = `spell:${r.cast.monsterSpell.index}`
        attacker.spent[key] = (attacker.spent[key] ?? 0) + 1
      }
      if (r.cast.concentration) {
        if (attacker.concentrating) extra.push('drops previous concentration')
        attacker.concentrating = true
        extra.push('concentrating')
      }
    }
    if (r.detail) extra.unshift(r.detail)

    const action = r.action
    if (lines.length === 0) {
      lines.push(`${attacker.name} uses ${action.name}`)
      publicLines.push(`${attacker.name} uses ${action.name}`)
    }
    const suffix = extra.length ? ` [${extra.join('; ')}]` : ''
    if (lines.length === 1) logEvent(s, lines[0] + suffix)
    else logEvent(s, `${attacker.name} uses ${action.name}${suffix}: ${lines.join(' | ')}`)
    // players hear about every target, but not rolls
    for (const p of publicLines) announce(s, p)

    // economy trackers, legendary uses, limited-use actions
    attacker.turn ??= freshTurn()
    const timing = action.timing ?? 'action'
    if (timing === 'bonus') attacker.turn.bonus = true
    else if (timing === 'reaction') attacker.turn.reaction = true
    else if (timing === 'action') attacker.turn.action = true
    if (timing === 'legendary' && attacker.legendary) attacker.legendary.used = Math.min(attacker.legendary.max, attacker.legendary.used + 1)
    if (action.limited) {
      attacker.spent ??= {}
      attacker.spent[action.id] = action.limited.kind === 'day' ? (attacker.spent[action.id] ?? 0) + 1 : 1
    }

    return {
      label: lines[0],
      refund: r.cast?.spent && r.cast.slotLevel > 0 && attacker.characterId !== undefined ? { characterId: attacker.characterId, level: r.cast.slotLevel } : undefined,
    }
  }
}

export const resolveAction = (r: ActionResolution) => mutateCombat((s) => applyResolution(s, r))

/* ------------------------------------------------------------------------------------------------------------ */
/* Misc                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

export type HpStatus = 'Healthy' | 'Bloodied' | 'Defeated'

/** What the players see for monsters instead of exact HP. */
export const hpStatus = (c: Combatant): HpStatus => (c.hp === 0 ? 'Defeated' : c.hp * 2 <= c.maxHp ? 'Bloodied' : 'Healthy')

/** Monsters count as the same kind when they came from the same template ("Goblin Warrior 1" and "...2"). */
const kindOf = (c: Combatant) => c.templateRef?.name ?? c.name.replace(/ \d+$/, '')

/** Roll initiative for every monster (Surprised ones with Disadvantage). Grouped: one roll per kind of monster. */
export function rollAllMonsterInitiative(s: CombatState, grouped = false) {
  const shared = new Map<string, number>()
  s.combatants.forEach((c) => {
    if (c.kind !== 'monster') return
    const key = kindOf(c)
    if (grouped && shared.has(key)) c.initiative = shared.get(key)!
    else {
      c.initiative = rollInitiative(c.initiativeBonus, !!c.surprised)
      shared.set(key, c.initiative)
    }
  })
  sortCombatants(s)
}

/** Give every monster of the same kind the same initiative as `c` (group initiative). */
export function shareInitiative(s: CombatState, c: Combatant) {
  if (c.kind !== 'monster' || c.initiative === null) return
  const key = kindOf(c)
  s.combatants.forEach((x) => {
    if (x.kind === 'monster' && kindOf(x) === key) x.initiative = c.initiative
  })
  sortCombatants(s)
}

export function toggleSurprised(_s: CombatState, c: Combatant) {
  if (c.surprised) delete c.surprised
  else c.surprised = true
}

/**
 * The active creature delays: it acts later this round, just after `afterId` (who must still be due to act this round).
 * Its initiative becomes that creature's, so the new place sticks in later rounds, and play moves on to whoever was next.
 */
export function delayTurn(s: CombatState, afterId: string) {
  const idx = s.turnIndex
  const me = s.combatants[idx]
  const after = s.combatants.findIndex((c) => c.id === afterId)
  if (!me || after <= idx) return
  const anchor = s.combatants[after]
  me.initiative = anchor.initiative
  // slot into the tie order right behind the anchor: halfway to whoever follows it in the same initiative, or one step behind
  const next = s.combatants.slice(after + 1).find((c) => c.initiative === anchor.initiative)
  me.tieRank = next ? (tieRankOf(anchor) + tieRankOf(next)) / 2 : tieRankOf(anchor) + 1
  const [moved] = s.combatants.splice(idx, 1)
  s.combatants.splice(after, 0, moved) // removing it shifted the anchor to `after - 1`, so this puts it right behind the anchor
  s.turnIndex = idx - 1 // advanceTurn steps onto the creature that moved into this slot
  logEvent(s, `${me.name} delays their turn until after ${anchor.name}`)
  announce(s, `${me.name} delays their turn`)
  advanceTurn(s)
}

/**
 * Set the Exhaustion level (0-6). The Exhaustion condition follows it; level 6 is death.
 */
export function setExhaustion(s: CombatState, c: Combatant, level: number) {
  const n = Math.max(0, Math.min(6, Math.round(level)))
  c.exhaustion = n
  c.conditions = n > 0 ? (c.conditions.includes('Exhaustion') ? c.conditions : [...c.conditions, 'Exhaustion']) : c.conditions.filter((x) => x !== 'Exhaustion')
  if (n >= 6 && c.hp > 0) {
    c.hp = 0
    c.concentrating = false
    if (c.kind === 'pc') {
      c.deathSaves.failures = 3
      if (!c.conditions.includes('Unconscious')) c.conditions.push('Unconscious')
    }
    logEvent(s, `${c.name} dies of exhaustion (level 6)`)
    announce(s, `${c.name} has died`)
  } else if (n > 0) {
    logEvent(s, `${c.name} is at Exhaustion level ${n}`)
  }
}

/** Is this action available (not spent / out of daily uses)? */
export function actionAvailable(c: Combatant, a: Action): { ok: boolean; why?: string } {
  const spent = c.spent?.[a.id] ?? 0
  if (a.limited?.kind === 'recharge' && spent) return { ok: false, why: `needs to recharge (${a.limited.min}${a.limited.min < 6 ? '-6' : ''})` }
  if (a.limited?.kind === 'day' && spent >= a.limited.times) return { ok: false, why: `${a.limited.times}/day used up` }
  if (a.limited?.kind === 'rest' && spent) return { ok: false, why: 'used until the next rest' }
  if (a.timing === 'legendary' && c.legendary && c.legendary.used >= c.legendary.max) return { ok: false, why: 'no legendary actions left' }
  return { ok: true }
}

/** End the fight: write PC hit points back to the party, drop the monsters, reset for next time. */
export async function endCombat() {
  const state = await db.combat.get('current')
  if (state) {
    await Promise.all(
      state.combatants
        .filter((c) => c.kind === 'pc' && c.characterId !== undefined)
        .map((c) => db.characters.update(c.characterId!, { currentHp: c.hp, exhaustion: exhaustionLevel(c) })),
    )
    // a fight that actually happened goes into the campaign journal
    if (state.started && state.round > 0) await addCombatSummary(state)
  }
  await db.transaction('rw', db.combat, async () => {
    const s = normalize(structuredClone((await db.combat.get('current')) ?? EMPTY))
    s.combatants = s.combatants.filter((c) => c.kind === 'pc')
    s.combatants.forEach((c) => {
      c.initiative = null
      delete c.tieRank
      delete c.surprised
      c.tempHp = 0
      c.conditions = exhaustionLevel(c) > 0 ? ['Exhaustion'] : []
      c.concentrating = false
      c.deathSaves = { successes: 0, failures: 0 }
      c.turn = freshTurn()
    })
    s.started = false
    s.round = 0
    s.turnIndex = 0
    s.log = []
    s.prompts = []
    s.events = []
    s.history = []
    await db.combat.put(s)
  })
}
