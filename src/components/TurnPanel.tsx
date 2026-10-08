import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { usePromise } from '../hooks'
import { actionAvailable, advanceTurn, delayTurn, isDown, mutateCombat, resolveAction, type TargetOutcome } from '../lib/combat'
import { conditionReminders, isIncapacitated } from '../lib/conditionRules'
import { formatMod } from '../lib/dice'
import { canAppRoll, useSettings } from '../lib/settings'
import { castableLevels, levelLabel, slotsLeft, slotsLeftAtOrAbove, spellToAction } from '../lib/spells'
import { getSpell } from '../lib/srdApi'
import { spendSlot } from '../lib/store'
import { stepsFromMultiattack, stepsFromVolley } from '../lib/volley'
import type { Action, Combatant, CombatState, KnownSpell, TurnUsed } from '../types'
import { Combobox } from './Combobox'
import { AttackResolver } from './turn/AttackResolver'
import { AttackSequence } from './turn/AttackSequence'
import { DamageEntry } from './turn/DamageEntry'
import { useDamageEntry } from './turn/useDamageEntry'
import { SaveResolver } from './turn/SaveResolver'
import { UsePips } from './UsePips'

const TIMING_LABEL = { action: 'Actions', bonus: 'Bonus actions', reaction: 'Reactions', legendary: 'Legendary' } as const
const ECONOMY: { key: keyof TurnUsed; label: string }[] = [
  { key: 'action', label: 'Action' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'reaction', label: 'Reaction' },
]

/**
 * The DM's "do something on this turn" panel: pick an action (or cast a spell) and its target(s), enter the d20s and
 * damage, apply it, repeat for extra attacks, then end the turn. Players' dice are always typed in; the app only rolls
 * for monsters (and for players only if that is switched on in Settings).
 * Mount it with `key` set to the turn so its local state resets whenever the turn changes.
 */
export function TurnPanel({ combat }: { combat: CombatState }) {
  const settings = useSettings()
  const { combatants } = combat
  const active = combatants[combat.turnIndex]

  const [attackerId, setAttackerId] = useState<string>()
  const [actionId, setActionId] = useState<string>()
  const [spellIndex, setSpellIndex] = useState<string>()
  const [slotChoice, setSlotChoice] = useState<number>()
  const [freeCast, setFreeCast] = useState(false)
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [nonce, setNonce] = useState(0)
  const [delaying, setDelaying] = useState(false)
  const [delayAfter, setDelayAfter] = useState('')

  const attacker = combatants.find((c) => c.id === attackerId) ?? active
  // Spell slots live on the character (they persist across fights), not on the combat snapshot.
  const character = useLiveQuery(
    () => (attacker?.characterId !== undefined ? db.characters.get(attacker.characterId) : undefined),
    [attacker?.characterId],
  )
  const sc = character?.spellcasting
  // Monsters cast from their Spellcasting list: no slots, just "at will" or N per day
  const monsterCaster = !sc && attacker?.kind === 'monster' && (attacker.spells?.length ?? 0) > 0
  const knownSpells: KnownSpell[] = sc
    ? [...sc.cantrips, ...sc.prepared]
    : monsterCaster
      ? attacker!.spells!.map((s) => ({ index: s.index, name: s.name, level: s.level }))
      : []
  const known = knownSpells.find((s) => s.index === spellIndex)
  const spellDetail = usePromise(() => (known ? getSpell(known.index) : Promise.resolve(undefined)), [known?.index])

  if (!active || !attacker || attacker.kind === 'lair') return active?.kind === 'lair' ? <LairPanel combat={combat} lair={active} /> : null

  const actions = attacker.actions ?? []
  const castLevels = sc && known ? castableLevels(sc, known.level) : []
  const slotLevel = !known || known.level === 0 ? 0 : monsterCaster ? known.level : castLevels.includes(slotChoice ?? -1) ? slotChoice! : (castLevels[0] ?? known.level)
  const monsterSpell = monsterCaster && known ? attacker.spells!.find((s) => s.index === known.index) : undefined
  const castsLeft = monsterSpell?.times ? monsterSpell.times - (attacker.spent?.[`spell:${monsterSpell.index}`] ?? 0) : Infinity
  const slotOk = !known || (monsterCaster ? castsLeft > 0 : known.level === 0 || freeCast || castLevels.includes(slotLevel))

  let spellAction: Action | undefined
  if (known && attacker.casting) {
    if (spellDetail.data) spellAction = spellToAction(spellDetail.data, slotLevel, attacker.casting)
    else if (!spellDetail.loading) spellAction = { id: `spell:${known.index}`, name: known.name, kind: 'other' }
  }
  const spellMode = !!known
  const defaultAction = actions.find((a) => (a.timing ?? 'action') === 'action' && a.kind !== 'other' && actionAvailable(attacker, a).ok) ?? actions[0]
  const action: Action | undefined = spellMode ? spellAction : (actions.find((a) => a.id === actionId) ?? defaultAction)

  // several separate attacks (Scorching Ray, Multiattack...) pick their targets row by row instead of up here
  const multiSteps = action?.multiattack ? stepsFromMultiattack(action, actions) : undefined
  const sequence = action?.kind === 'attack' && action.volley ? stepsFromVolley(action) : multiSteps?.steps.length ? multiSteps.steps : undefined
  const multi = !!action && action.kind !== 'attack'
  const pickable = combatants.filter((c) => c.kind !== 'lair' && (multi || c.id !== attacker.id))
  const chosen = targetIds.map((id) => combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c)
  const targets = multi ? chosen : chosen.slice(0, 1)

  const toggleTurn = (key: keyof TurnUsed) => mutateCombat((s) => {
    const a = s.combatants.find((c) => c.id === attacker.id)
    if (a) a.turn = { action: false, bonus: false, reaction: false, ...a.turn, [key]: !(a.turn?.[key] ?? false) }
  }, `${attacker.name}: ${key} tracker`)
  const setCounter = (kind: 'legendary' | string, used: number) => mutateCombat((s) => {
    const a = s.combatants.find((c) => c.id === attacker.id)
    if (!a) return
    if (kind === 'legendary' && a.legendary) a.legendary.used = used
    else a.counters?.forEach((k) => k.id === kind && (k.used = used))
  }, `${attacker.name}: counter`)

  const submit = async (outcomes: TargetOutcome[], detail: string) => {
    if (!action) return
    let cast
    if (known) {
      const spendsSlot = !monsterCaster && known.level > 0 && !freeCast
      if (spendsSlot && attacker.characterId !== undefined) await spendSlot(attacker.characterId, slotLevel)
      cast = {
        slotLevel: spendsSlot ? slotLevel : 0,
        spent: spendsSlot && attacker.characterId !== undefined,
        concentration: !!spellDetail.data?.concentration,
        monsterSpell: monsterSpell ? { index: monsterSpell.index, times: monsterSpell.times } : undefined,
      }
    }
    await resolveAction({ attackerId: attacker.id, action, targets: outcomes, cast, detail })
    setNonce((n) => n + 1)
  }

  const chooseAction = (id: string) => {
    setActionId(id)
    setSpellIndex(undefined)
    setNonce((n) => n + 1)
  }
  const addTarget = (id: string | undefined) => {
    if (!id) return
    setTargetIds((t) => (multi ? (t.includes(id) ? t : [...t, id]) : [id]))
    setNonce((n) => n + 1)
  }
  const reminders = conditionReminders(attacker)
  // creatures that haven't acted yet this round and could be waited for (the lair marker and defeated monsters can't)
  const later = combatants.slice(combat.turnIndex + 1).filter((c) => c.kind !== 'lair' && !(c.kind === 'monster' && isDown(c)))
  const resolverKey = `${nonce}|${action?.id}|${slotLevel}|${targets.map((t) => t.id).join(',')}`

  return (
    <div className="turn-panel">
      <div className="row gap wrap">
        <h3>
          {attacker.name}
          {attacker.id === active.id ? "'s turn" : ' acts out of turn'}
        </h3>
        <label className="field">
          <span>Acting</span>
          <select
            value={attacker.id}
            onChange={(e) => {
              setAttackerId(e.target.value)
              setActionId(undefined)
              setSpellIndex(undefined)
              setTargetIds([])
              setNonce((n) => n + 1)
            }}
          >
            {combatants.filter((c) => c.kind !== 'lair').map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === active.id ? '▶ ' : ''}
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {attacker.id === active.id && (
          <button className="end-turn" disabled={later.length === 0} title="Act later this round, just after someone who hasn't gone yet" onClick={() => setDelaying((d) => !d)}>
            Delay ⏳
          </button>
        )}
        <button className="primary end-turn" onClick={() => mutateCombat(advanceTurn, 'End turn')}>
          End turn ▶
        </button>
      </div>

      {delaying && (
        <div className="row gap wrap delay-row">
          <label className="field">
            <span>{active.name} acts after…</span>
            <select value={delayAfter || later[0]?.id} onChange={(e) => setDelayAfter(e.target.value)}>
              {later.map((c) => (
                <option key={c.id} value={c.id}>{c.name} (initiative {c.initiative})</option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={() => mutateCombat((s) => delayTurn(s, delayAfter || later[0].id), `${active.name} delays`)}>
            Delay their turn
          </button>
          <button onClick={() => setDelaying(false)}>Cancel</button>
        </div>
      )}

      <div className="economy">
        {ECONOMY.map(({ key, label }) => (
          <button key={key} className={`pill ${attacker.turn?.[key] ? 'used' : ''}`} onClick={() => toggleTurn(key)} title={`Click to mark the ${label.toLowerCase()} as ${attacker.turn?.[key] ? 'available' : 'used'}`}>
            {attacker.turn?.[key] ? '✕' : '○'} {label}
          </button>
        ))}
        {attacker.legendary && (
          <span className="counter">
            Legendary actions <UsePips max={attacker.legendary.max} used={attacker.legendary.used} label="legendary actions" onChange={(u) => setCounter('legendary', u)} />
          </span>
        )}
        {(attacker.counters ?? []).map((k) => (
          <span className="counter" key={k.id}>
            {k.name} <UsePips max={k.max} used={k.used} label={k.name} onChange={(u) => setCounter(k.id, u)} />
          </span>
        ))}
      </div>

      {reminders.length > 0 && (
        <div className="reminders">
          {isIncapacitated(attacker) && <div className="warn">⚠ {attacker.name} is Incapacitated and can't take actions, bonus actions or reactions.</div>}
          {reminders.map((r) => (
            <div key={r.name}><strong>{r.name}:</strong> {r.text}</div>
          ))}
        </div>
      )}

      {actions.length === 0 && knownSpells.length === 0 ? (
        <p className="muted">
          {attacker.name} has no actions. Add some on the {attacker.kind === 'pc' ? 'Party' : 'Bestiary'} tab, or use the Dmg / Heal buttons on the rows below.
        </p>
      ) : (
        <>
          {(['action', 'bonus', 'reaction', 'legendary'] as const).map((timing) => {
            const list = actions.filter((a) => (a.timing ?? 'action') === timing)
            if (!list.length) return null
            return (
              <div className="chips" key={timing}>
                <span className="muted">{TIMING_LABEL[timing]}</span>
                {list.map((a) => {
                  const avail = actionAvailable(attacker, a)
                  return (
                    <button
                      key={a.id}
                      className={`chip ${!spellMode && a.id === action?.id ? 'selected' : ''} ${avail.ok ? '' : 'unavailable'}`}
                      disabled={!avail.ok}
                      title={avail.why}
                      onClick={() => chooseAction(a.id)}
                    >
                      {a.name || 'Unnamed'}
                      <small>
                        {a.kind === 'attack' && ` ${formatMod(a.attackBonus ?? 0)}`}
                        {a.kind === 'save' && ` DC ${a.saveDc ?? 10} ${(a.saveAbility ?? 'dex').toUpperCase()}`}
                        {a.damage && ` · ${a.damage}`}
                        {a.limited?.kind === 'recharge' && ` · ↻${a.limited.min}${a.limited.min < 6 ? '-6' : ''}`}
                        {a.limited?.kind === 'day' && ` · ${(a.limited.times ?? 1) - (attacker.spent?.[a.id] ?? 0)}/${a.limited.times}`}
                        {!avail.ok && ` · ${avail.why}`}
                      </small>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {(sc || monsterCaster) && knownSpells.length > 0 && (
            <div className="chips">
              <span className="muted">Spell</span>
              <Combobox
                className={`target-select ${spellMode ? 'selected-select' : ''}`}
                placeholder="Search spells…"
                clearLabel="- no spell -"
                value={spellIndex}
                options={[...knownSpells]
                  .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
                  .map((s) => {
                    if (!sc) {
                      const ms = attacker.spells!.find((x) => x.index === s.index)!
                      const left = ms.times ? ms.times - (attacker.spent?.[`spell:${ms.index}`] ?? 0) : undefined
                      return { value: s.index, label: s.name, group: ms.times ? `${ms.times}/day each` : 'At will', hint: left === undefined ? levelLabel(s.level) : `${left} left` }
                    }
                    return {
                      value: s.index,
                      label: s.name,
                      group: s.level === 0 ? 'Cantrips' : `${levelLabel(s.level)} level`,
                      hint: s.level === 0 ? undefined : `${slotsLeftAtOrAbove(sc, s.level)} slot${slotsLeftAtOrAbove(sc, s.level) === 1 ? '' : 's'}`,
                    }
                  })}
                onChange={(v) => {
                  setSpellIndex(v)
                  setSlotChoice(undefined)
                  setFreeCast(false)
                  setNonce((n) => n + 1)
                }}
              />
              {sc && known && known.level > 0 && (
                <>
                  <select
                    value={slotLevel}
                    onChange={(e) => {
                      setSlotChoice(Number(e.target.value))
                      setNonce((n) => n + 1)
                    }}
                    disabled={freeCast}
                  >
                    {(castLevels.length ? castLevels : [known.level]).map((l) => (
                      <option key={l} value={l}>
                        {levelLabel(l)} slot ({slotsLeft(sc, l)} left){l > known.level ? ' ↑' : ''}
                      </option>
                    ))}
                  </select>
                  <label className="row gap" title="Ritual, a feature, or a free cast: don't spend a slot">
                    <input type="checkbox" checked={freeCast} onChange={(e) => setFreeCast(e.target.checked)} /> No slot
                  </label>
                </>
              )}
              {spellMode && !slotOk && <span className="warn">{monsterCaster ? 'No casts left today.' : 'No slots left at that level.'}</span>}
              {spellMode && spellDetail.loading && <span className="muted">Loading spell…</span>}
            </div>
          )}

          {action && (
            <>
              {action.desc && (action.kind !== 'other' || sequence) && (
                <details className="rules-text">
                  <summary>Rules text: {action.name}</summary>
                  <p>{action.desc}</p>
                </details>
              )}

              {!sequence && (
              <div className="chips target-row">
                <span className="muted">{multi ? 'Targets' : 'Target'}</span>
                <Combobox
                  className="target-select"
                  placeholder={multi ? 'Add a target…' : 'Choose a target…'}
                  value={multi ? undefined : targets[0]?.id}
                  options={pickable.map((c) => ({
                    value: c.id,
                    label: c.name,
                    group: c.kind === 'pc' ? 'Party' : 'Enemies',
                    hint: `AC ${c.ac} · ${c.hp}/${c.maxHp}${c.hp === 0 ? ' (down)' : ''}`,
                  }))}
                  onChange={addTarget}
                />
                {multi && (
                  <>
                    <button onClick={() => { setTargetIds(pickable.filter((c) => c.kind === 'monster' && c.hp > 0 && c.id !== attacker.id).map((c) => c.id)); setNonce((n) => n + 1) }}>All enemies</button>
                    <button onClick={() => { setTargetIds(pickable.filter((c) => c.kind === 'pc' && c.id !== attacker.id).map((c) => c.id)); setNonce((n) => n + 1) }}>All party</button>
                    {targets.length > 0 && <button onClick={() => { setTargetIds([]); setNonce((n) => n + 1) }}>Clear</button>}
                  </>
                )}
                {multi && action.area && <span className="area-hint">Area: {action.area}. Pick everyone in it.</span>}
              </div>
              )}
              {!sequence && multi && targets.length > 0 && (
                <div className="spell-chips">
                  {targets.map((t) => (
                    <span className="spell-chip" key={t.id}>
                      {t.name}
                      <button className="x" aria-label={`Remove ${t.name}`} onClick={() => { setTargetIds((ids) => ids.filter((x) => x !== t.id)); setNonce((n) => n + 1) }}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {sequence && (
                <AttackSequence
                  key={resolverKey}
                  attacker={attacker}
                  steps={sequence}
                  pickable={pickable}
                  canRoll={canAppRoll(attacker.kind, settings)}
                  melee={!/range/i.test(action.range ?? sequence[0].actions[0].range ?? '') || /reach/i.test(action.range ?? sequence[0].actions[0].range ?? '')}
                  onApply={submit}
                />
              )}
              {multiSteps && multiSteps.missing.length > 0 && (
                <p className="muted">
                  Multiattack also lists {multiSteps.missing.join(', ')}: use {multiSteps.missing.length === 1 ? 'it' : 'them'} from the {attacker.spells?.length ? 'Spell list' : 'action list'} instead.
                </p>
              )}
              {!sequence && action.kind === 'attack' && targets[0] && (
                <AttackResolver key={resolverKey} attacker={attacker} action={action} target={targets[0]} canRoll={canAppRoll(attacker.kind, settings)} onApply={submit} />
              )}
              {action.kind === 'save' && targets.length > 0 && (
                <SaveResolver
                  key={resolverKey}
                  attacker={attacker}
                  action={action}
                  targets={targets}
                  canRollFor={(c) => canAppRoll(c.kind, settings)}
                  canRollDamage={canAppRoll(attacker.kind, settings)}
                  onApply={submit}
                />
              )}
              {action.kind === 'heal' && targets.length > 0 && (
                <HealResolver key={resolverKey} action={action} targets={targets} canRoll={canAppRoll(attacker.kind, settings)} onApply={submit} />
              )}
              {!sequence && action.kind === 'other' && (
                <div className="resolve">
                  {action.desc && <p className="rules-text-inline">{action.desc}</p>}
                  <p className="muted">
                    {action.name} has no attack roll, save or healing the app can read. Using it
                    {known ? ' spends the slot and sets concentration if needed' : ''}; apply any damage or effects with the controls on the rows below.
                    {action.damage ? ` (damage: ${action.damage}${action.damageType ? ` ${action.damageType}` : ''})` : ''}
                  </p>
                  <div className="row gap">
                    <button
                      className="primary"
                      disabled={!slotOk}
                      onClick={() => submit(targets.map((t): TargetOutcome => ({ targetId: t.id, result: 'cast', parts: [], applyCondition: false })), '')}
                    >
                      {known ? 'Cast' : 'Use'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {combat.log && combat.log.length > 0 && (
        <ul className="log">
          {combat.log
            .slice(-6)
            .reverse()
            .map((line, i) => (
              <li key={combat.log.length - i}>{line}</li>
            ))}
        </ul>
      )}
    </div>
  )
}

function HealResolver({ action, targets, canRoll, onApply }: { action: Action; targets: Combatant[]; canRoll: boolean; onApply: (o: TargetOutcome[], d: string) => void }) {
  const entry = useDamageEntry(action, { crit: false, advantage: false })
  const amount = entry.out.reduce((n, p) => n + p.amount, 0)
  return (
    <div className="resolve">
      <DamageEntry entry={entry} label="Healing" canRoll={canRoll} />
      <div className="row gap">
        <button
          className="primary"
          disabled={!entry.complete}
          onClick={() => onApply(targets.map((t): TargetOutcome => ({ targetId: t.id, result: 'heal', parts: [{ type: '', amount }], applyCondition: false })), entry.detail)}
        >
          Heal {amount} {targets.length > 1 ? `each (${targets.length})` : ''}
        </button>
      </div>
    </div>
  )
}

/** The lair-actions marker's turn: just a reminder with room for notes. */
function LairPanel({ combat, lair }: { combat: CombatState; lair: Combatant }) {
  return (
    <div className="turn-panel">
      <div className="row gap wrap">
        <h3>Lair actions (initiative 20)</h3>
        <button className="primary end-turn" onClick={() => mutateCombat(advanceTurn, 'End turn')}>
          End turn ▶
        </button>
      </div>
      <p className="muted">A creature that fights in its lair can take one lair action now. Describe it to the table and apply the effect with the controls on the rows below.</p>
      <label className="field">
        <span>Notes</span>
        <textarea
          rows={2}
          value={lair.notes ?? ''}
          placeholder="Lair action options for this fight"
          onChange={(e) => mutateCombat((s) => { const l = s.combatants.find((c) => c.id === lair.id); if (l) l.notes = e.target.value }, 'Lair notes')}
        />
      </label>
      {combat.log.length > 0 && (
        <ul className="log">
          {combat.log.slice(-4).reverse().map((line, i) => <li key={combat.log.length - i}>{line}</li>)}
        </ul>
      )}
    </div>
  )
}
