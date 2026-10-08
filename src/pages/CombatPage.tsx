import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { InitiativeInput } from '../components/InitiativeInput'
import { Portrait } from '../components/Portrait'
import { Rich } from '../components/Rich'
import { RewardBanner } from '../components/RewardBanner'
import { TurnPanel } from '../components/TurnPanel'
import { rateEncounter, encounterXp, entriesFromCombat } from '../lib/encounters'
import { useSrdMonsters, useCustomMonsters } from '../lib/monsterLibrary'
import {
  advanceTurn,
  damageRow,
  endCombat,
  healRow,
  lairCombatant,
  mutateCombat,
  pcCombatant,
  rollAllMonsterInitiative,
  setDeathSaves,
  setExhaustion,
  settleConcentration,
  settleRecharge,
  shareInitiative,
  sortCombatants,
  startCombat,
  toggleSurprised,
  undoCombat,
} from '../lib/combat'
import { formatMod, rollDie, rollInitiative } from '../lib/dice'
import { t, tCondition, tDamage } from '../lib/i18n'
import { canAppRoll, updateSettings, useSettings, type Settings } from '../lib/settings'
import { saveBonus } from '../lib/resolve'
import { exhaustionLevel } from '../lib/conditionRules'
import { CONDITIONS, type Combatant, type Condition, type Prompt, type TurnUsed } from '../types'

export function CombatPage({ goTo }: { goTo?: (tab: 'encounters') => void }) {
  const settings = useSettings()
  const combat = useLiveQuery(() => db.combat.get('current'), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const { monsters: srd } = useSrdMonsters()
  const custom = useCustomMonsters()
  const combatants = combat?.combatants ?? []
  const started = combat?.started ?? false
  const imageFor = (c: Combatant) => characters?.find((ch) => ch.id === c.characterId)?.image
  const lastUndo = combat?.history?.at(-1)

  const addParty = () =>
    mutateCombat((s) => {
      const present = new Set(s.combatants.map((c) => c.characterId))
      characters?.filter((ch) => !present.has(ch.id)).forEach((ch) => s.combatants.push(pcCombatant(ch)))
      if (s.started) sortCombatants(s)
    }, t('lbl.addedParty'))

  const saveEncounter = async () => {
    const entries = entriesFromCombat(combatants)
    if (!entries.length) return alert(t('combat.addMonstersFirst'))
    const name = prompt(t('combat.namePrompt'), t('combat.newEncounter'))?.trim()
    if (name) await db.encounters.add({ name, notes: '', entries })
  }

  const allSet = combatants.length > 0 && combatants.every((c) => c.initiative !== null)
  const monsters = combatants.filter((c) => c.kind === 'monster')
  const partyLevels = (characters ?? []).filter((ch) => combatants.some((c) => c.characterId === ch.id)).map((ch) => ch.level)
  const xp = encounterXp(entriesFromCombat(combatants), srd, custom)
  const rating = monsters.length && partyLevels.length ? rateEncounter(xp, partyLevels) : null

  return (
    <div className="page">
      <div className="toolbar">
        <h2>
          {t('combat.title')} {started && <span className="muted">{t('combat.round', { n: combat?.round ?? 0 })}</span>}
        </h2>
        <button onClick={addParty}>{t('combat.addParty')}</button>
        <button onClick={() => mutateCombat((s) => rollAllMonsterInitiative(s, settings.groupInitiative), t('lbl.rolledInit'))}>{t('combat.rollMonsters')}</button>
        {!started ? (
          <button className="primary" disabled={!allSet} onClick={() => mutateCombat(startCombat, t('lbl.started'))}>
            {t('combat.start')}
          </button>
        ) : (
          <>
            <button className="primary" onClick={() => mutateCombat(advanceTurn, t('lbl.nextTurn'))}>
              {t('combat.next')}
            </button>
            <button className="danger" onClick={() => confirm(t('combat.endConfirm')) && endCombat()}>
              {t('combat.end')}
            </button>
          </>
        )}
        <button disabled={!lastUndo} title={lastUndo ? t('combat.undoTitle', { label: lastUndo.label }) : t('combat.nothingUndo')} onClick={() => undoCombat()}>
          {t('combat.undo')}
        </button>
        <button onClick={() => window.open('#player', 'dnd-player-view')}>{t('combat.openPlayer')}</button>
      </div>

      <div className="toolbar sub">
        <button onClick={() => mutateCombat((s) => { if (!s.combatants.some((c) => c.kind === 'lair')) { s.combatants.push(lairCombatant()); if (s.started) sortCombatants(s) } }, t('lbl.addedLair'))}>
          {t('combat.lair')}
        </button>
        <button onClick={saveEncounter} disabled={!monsters.length}>
          {t('combat.saveEncounter')}
        </button>
        {goTo && <button onClick={() => goTo('encounters')}>{t('combat.savedEncounters')}</button>}
        <label className="check small" title={t('combat.groupTitle')}>
          <input type="checkbox" checked={settings.groupInitiative} onChange={(e) => updateSettings({ groupInitiative: e.target.checked })} />
          <span>{t('combat.group')}</span>
        </label>
        {rating && (
          <span className="difficulty" title={t('combat.budgetTitle', { xp, low: rating.budget.low, mod: rating.budget.moderate, high: rating.budget.high })}>
            {xp} XP · <strong className={`diff ${rating.difficulty?.replace(' ', '-').toLowerCase()}`}>{rating.difficulty ? t(`diff.${rating.difficulty}`) : ''}</strong> {t('combat.forParty')}
          </span>
        )}
      </div>

      {!started && <RewardBanner />}

      {(combat?.prompts ?? []).map((p) => (
        <PromptBanner key={p.id} prompt={p} combatants={combatants} settings={settings} />
      ))}

      {!started && combatants.length > 0 && !allSet && <p className="muted">{t('combat.needInit')}</p>}
      {combatants.length === 0 && <p className="muted">{t('combat.emptyHint')}</p>}

      {started && combat && <TurnPanel key={`${combat.round}-${combat.turnIndex}-${combat.combatants[combat.turnIndex]?.id}`} combat={combat} />}

      <div className="combatants">
        {combatants.map((c, i) => (
          <CombatantRow key={c.id} c={c} active={started && i === combat?.turnIndex} started={started} image={imageFor(c)} settings={settings} />
        ))}
      </div>
    </div>
  )
}

/** Something to resolve: a concentration save, or a recharge roll. Players' d20s are typed in; monsters' can be rolled. */
function PromptBanner({ prompt, combatants, settings }: { prompt: Prompt; combatants: Combatant[]; settings: Settings }) {
  const c = combatants.find((x) => x.id === prompt.combatantId)
  const [d, setD] = useState('')
  if (!c) return null
  const roll = d === '' ? undefined : Number(d)
  const canRoll = canAppRoll(c.kind, settings)

  if (prompt.kind === 'concentration') {
    const bonus = saveBonus(c, 'con')
    const total = roll === undefined ? undefined : roll + bonus
    const pass = total === undefined ? undefined : total >= prompt.dc
    return (
      <div className="prompt-banner">
        <Rich text={t('prompt.conc', { dc: prompt.dc, bonus: formatMod(bonus) })} parts={{ name: <strong>{c.name}</strong> }} />
        <input className="narrow" type="number" placeholder="d20" value={d} onChange={(e) => setD(e.target.value)} aria-label="d20" />
        {canRoll && <button onClick={() => setD(String(rollDie(20)))}>🎲</button>}
        {total !== undefined && <span className={pass ? 'adv' : 'dis'}>{total} → {pass ? t('prompt.keeps') : t('prompt.loses')}</span>}
        <button className="primary" disabled={pass === undefined} onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, !!pass), t('lbl.concCheck', { name: c.name }))}>
          {t('prompt.apply')}
        </button>
        <button title={t('prompt.passedTitle')} onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, true), t('lbl.concKept', { name: c.name }))}>{t('prompt.passed')}</button>
        <button className="danger" onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, false), t('lbl.concLost', { name: c.name }))}>{t('prompt.failed')}</button>
      </div>
    )
  }
  const action = c.actions.find((a) => a.id === prompt.actionId)
  return (
    <div className="prompt-banner">
      <Rich
        text={t('prompt.recharge', { range: `${prompt.min}${prompt.min < 6 ? '-6' : ''}` })}
        parts={{ name: <strong>{c.name}</strong>, action: <strong>{action?.name}</strong> }}
      />
      <input className="narrow" type="number" min={1} max={6} placeholder="d6" value={d} onChange={(e) => setD(e.target.value)} aria-label="d6" />
      <button onClick={() => setD(String(rollDie(6)))}>🎲</button>
      <button className="primary" disabled={roll === undefined} onClick={() => mutateCombat((s) => settleRecharge(s, prompt.id, roll!), t('lbl.recharge', { name: c.name }))}>
        {t('prompt.apply')}
      </button>
      <button onClick={() => mutateCombat((s) => { s.prompts = (s.prompts ?? []).filter((x) => x.id !== prompt.id) }, t('lbl.skippedRecharge'))}>{t('prompt.skip')}</button>
    </div>
  )
}

const ECON: { key: keyof TurnUsed; letter: 'econ.aLetter' | 'econ.bLetter' | 'econ.rLetter'; title: 'econ.action' | 'econ.bonus' | 'econ.reaction' }[] = [
  { key: 'action', letter: 'econ.aLetter', title: 'econ.action' },
  { key: 'bonus', letter: 'econ.bLetter', title: 'econ.bonus' },
  { key: 'reaction', letter: 'econ.rLetter', title: 'econ.reaction' },
]

function CombatantRow({ c, active, started, image, settings }: { c: Combatant; active: boolean; started: boolean; image?: Blob; settings: Settings }) {
  const [amount, setAmount] = useState('')
  const update = (fn: (c: Combatant) => void, resort = false, label?: string) =>
    mutateCombat((s) => {
      const target = s.combatants.find((x) => x.id === c.id)
      if (!target) return
      fn(target)
      if (resort) sortCombatants(s)
    }, label ?? t('lbl.edit', { name: c.name }))
  const amt = Number(amount)
  const withState = (fn: (s: Parameters<Parameters<typeof mutateCombat>[0]>[0], who: Combatant) => void, label: string) =>
    mutateCombat((s) => {
      const who = s.combatants.find((x) => x.id === c.id)
      if (who) fn(s, who)
    }, label)

  const toggleCondition = (cond: Condition) =>
    update((who) => {
      who.conditions = who.conditions.includes(cond) ? who.conditions.filter((x) => x !== cond) : [...who.conditions, cond]
    }, false, `${c.name}: ${tCondition(cond)}`)
  const pct = c.maxHp ? Math.round((c.hp / c.maxHp) * 100) : 0
  const down = c.kind !== 'lair' && c.hp === 0
  const none = '-'

  if (c.kind === 'lair') {
    return (
      <div className={`combatant lair ${active ? 'active' : ''}`}>
        <InitiativeInput value={c.initiative} onCommit={(n) => update((who) => (who.initiative = n), true, t('lbl.lairInit'))} />
        <span />
        <div className="portrait placeholder" style={{ width: 48, height: 48, fontSize: 22 }}>☗</div>
        <div className="who">
          <strong>{c.name}</strong>
          <span className="muted">{c.notes || t('row.lairNote')}</span>
        </div>
        <span />
        <span />
        <span />
        <button title={t('row.removeTitle')} onClick={() => mutateCombat((s) => void (s.combatants = s.combatants.filter((x) => x.id !== c.id)), t('lbl.removedLair'))}>✕</button>
      </div>
    )
  }

  return (
    <div className={`combatant ${c.kind} ${active ? 'active' : ''} ${down ? 'down' : ''}`}>
      <InitiativeInput value={c.initiative} onCommit={(n) => withState((s, who) => { who.initiative = n; if (settings.groupInitiative) shareInitiative(s, who); else sortCombatants(s) }, t('lbl.initiative', { name: c.name }))} />
      {canAppRoll(c.kind, settings) ? (
        <button title={c.surprised ? t('row.rollInitSurprised') : t('row.rollInit')} onClick={() => withState((s, who) => { who.initiative = rollInitiative(who.initiativeBonus, !!who.surprised); if (settings.groupInitiative) shareInitiative(s, who); else sortCombatants(s) }, t('lbl.rolledInitOne', { name: c.name }))}>
          🎲
        </button>
      ) : (
        <span title={t('row.playersRoll')} />
      )}
      <Portrait name={c.name} image={image} size={48} />
      <div className="who">
        <strong>{c.name}</strong>
        <span className="muted">
          {t('row.ac', { n: c.ac })}
          {(c.resistances?.length || c.immunities?.length || c.vulnerabilities?.length) ? (
            <span
              className="defences"
              title={t('row.defences', {
                r: (c.resistances ?? []).map(tDamage).join(', ') || none,
                i: (c.immunities ?? []).map(tDamage).join(', ') || none,
                v: (c.vulnerabilities ?? []).map(tDamage).join(', ') || none,
              })}
            >
              {' '}🛡{c.resistances?.length ? ` R${c.resistances.length}` : ''}{c.immunities?.length ? ` I${c.immunities.length}` : ''}{c.vulnerabilities?.length ? ` V${c.vulnerabilities.length}` : ''}
            </span>
          ) : null}
        </span>
        {!started && (
          <label className="check small surprised" title={t('row.surprisedTitle')}>
            <input type="checkbox" checked={!!c.surprised} onChange={() => withState((s, who) => toggleSurprised(s, who), t('lbl.surprised', { name: c.name }))} />
            <span>
              {t('row.surprised')}
              {c.surprised ? (canAppRoll(c.kind, settings) ? t('row.surprisedRolls') : t('row.surprisedPlayer')) : ''}
            </span>
          </label>
        )}
        {active && (
          <span className="econ">
            {ECON.map(({ key, letter, title }) => (
              <button
                key={key}
                className={`econ-pip ${c.turn?.[key] ? 'used' : ''}`}
                title={t('econ.title', { what: t(title), state: c.turn?.[key] ? t('econ.used') : t('econ.available') })}
                onClick={() => update((who) => (who.turn = { action: false, bonus: false, reaction: false, ...who.turn, [key]: !(who.turn?.[key] ?? false) }), false, `${c.name}: ${t(title)}`)}
              >
                {t(letter)}
              </button>
            ))}
          </span>
        )}
        {c.legendary && <span className="muted tiny">{t('row.legendary', { left: c.legendary.max - c.legendary.used, max: c.legendary.max })}</span>}
        {c.kind === 'pc' && down && (
          <div className="saves" title={t('row.deathSaves')}>
            <Pips label="✓" n={c.deathSaves.successes} onChange={(n) => withState((s, who) => setDeathSaves(s, who, 'successes', n), t('lbl.deathSave', { name: c.name }))} />
            <Pips label="✗" n={c.deathSaves.failures} onChange={(n) => withState((s, who) => setDeathSaves(s, who, 'failures', n), t('lbl.deathSave', { name: c.name }))} />
          </div>
        )}
      </div>

      <div className="hp">
        <div className="bar">
          <div className="fill" style={{ width: `${pct}%` }} data-low={pct <= 50} />
        </div>
        <span>
          {c.hp}/{c.maxHp}
          {c.tempHp > 0 && <em>{t('row.temp', { n: c.tempHp })}</em>}
        </span>
      </div>

      <div className="row gap amount">
        <input
          className="narrow"
          type="number"
          min={0}
          placeholder="±"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && amt > 0) {
              withState((s, who) => damageRow(s, who, amt), t('lbl.damage', { name: c.name }))
              setAmount('')
            }
          }}
        />
        <button className="danger" onClick={() => { if (amt > 0) withState((s, who) => damageRow(s, who, amt), t('lbl.damage', { name: c.name })); setAmount('') }}>
          {t('row.dmg')}
        </button>
        <button onClick={() => { if (amt > 0) withState((s, who) => healRow(s, who, amt), t('lbl.heal', { name: c.name })); setAmount('') }}>{t('row.heal')}</button>
        <button
          title={t('row.tempTitle')}
          onClick={() => {
            if (amt > 0) update((who) => (who.tempHp = Math.max(who.tempHp, amt)), false, t('lbl.tempHp', { name: c.name }))
            setAmount('')
          }}
        >
          {t('row.tempBtn')}
        </button>
      </div>

      <details className="conditions">
        <summary title={[...c.conditions.map(tCondition), c.concentrating ? t('row.concentratingTitle') : ''].filter(Boolean).join(', ')}>
          {c.conditions.length ? c.conditions.map((x) => (x === 'Exhaustion' ? `${tCondition('Exhaustion')} ${exhaustionLevel(c)}` : tCondition(x))).join(', ') : t('row.conditions')}
          {c.concentrating && t('row.concentratingSummary')}
        </summary>
        <div className="popover">
          <label>
            <input type="checkbox" checked={c.concentrating} onChange={(e) => update((who) => (who.concentrating = e.target.checked), false, t('lbl.concentration', { name: c.name }))} />
            {t('row.concentratingTitle')}
          </label>
          <div className="exhaustion" title={t('row.exhaustionTitle')}>
            <span>{tCondition('Exhaustion')}</span>
            <button aria-label={t('row.lowerExhaustion')} disabled={exhaustionLevel(c) === 0} onClick={() => withState((s, who) => setExhaustion(s, who, exhaustionLevel(who) - 1), t('lbl.exhaustion', { name: c.name }))}>−</button>
            <strong>{exhaustionLevel(c)}</strong>
            <button aria-label={t('row.raiseExhaustion')} disabled={exhaustionLevel(c) >= 6} onClick={() => withState((s, who) => setExhaustion(s, who, exhaustionLevel(who) + 1), t('lbl.exhaustion', { name: c.name }))}>+</button>
          </div>
          {CONDITIONS.filter((cond) => cond !== 'Exhaustion').map((cond) => (
            <label key={cond}>
              <input type="checkbox" checked={c.conditions.includes(cond)} onChange={() => toggleCondition(cond)} />
              {tCondition(cond)}
            </label>
          ))}
        </div>
      </details>

      <button title={t('row.removeTitle')} onClick={() => mutateCombat((s) => void (s.combatants = s.combatants.filter((x) => x.id !== c.id)), t('lbl.removed', { name: c.name }))}>
        ✕
      </button>
    </div>
  )
}

function Pips({ label, n, onChange }: { label: string; n: number; onChange: (n: number) => void }) {
  return (
    <span className="pips">
      {[1, 2, 3].map((i) => (
        <button key={i} className={n >= i ? 'on' : ''} onClick={() => onChange(n === i ? i - 1 : i)}>
          {label}
        </button>
      ))}
    </span>
  )
}
