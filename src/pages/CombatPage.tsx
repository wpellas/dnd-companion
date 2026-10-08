import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { InitiativeInput } from '../components/InitiativeInput'
import { Portrait } from '../components/Portrait'
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
  settleConcentration,
  settleRecharge,
  sortCombatants,
  startCombat,
  undoCombat,
} from '../lib/combat'
import { formatMod, rollDie, rollInitiative } from '../lib/dice'
import { canAppRoll, useSettings, type Settings } from '../lib/settings'
import { saveBonus } from '../lib/resolve'
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
    }, 'Added the party')

  const saveEncounter = async () => {
    const entries = entriesFromCombat(combatants)
    if (!entries.length) return alert('Add some monsters first.')
    const name = prompt('Name this encounter:', 'New encounter')?.trim()
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
        <h2>Combat {started && <span className="muted">· Round {combat?.round}</span>}</h2>
        <button onClick={addParty}>+ Add party</button>
        <button onClick={() => mutateCombat(rollAllMonsterInitiative, 'Rolled monster initiative')}>🎲 Roll monster initiative</button>
        {!started ? (
          <button className="primary" disabled={!allSet} onClick={() => mutateCombat(startCombat, 'Combat started')}>
            Start combat
          </button>
        ) : (
          <>
            <button className="primary" onClick={() => mutateCombat(advanceTurn, 'Next turn')}>
              Next turn ▶
            </button>
            <button className="danger" onClick={() => confirm('End combat? Monsters are removed.') && endCombat()}>
              End combat
            </button>
          </>
        )}
        <button disabled={!lastUndo} title={lastUndo ? `Undo: ${lastUndo.label}` : 'Nothing to undo'} onClick={() => undoCombat()}>
          ↶ Undo
        </button>
        <button onClick={() => window.open('#player', 'dnd-player-view')}>Open player view ↗</button>
      </div>

      <div className="toolbar sub">
        <button onClick={() => mutateCombat((s) => { if (!s.combatants.some((c) => c.kind === 'lair')) { s.combatants.push(lairCombatant()); if (s.started) sortCombatants(s) } }, 'Added lair actions')}>
          ＋ Lair actions (initiative 20)
        </button>
        <button onClick={saveEncounter} disabled={!monsters.length}>
          💾 Save monsters as an encounter
        </button>
        {goTo && <button onClick={() => goTo('encounters')}>📜 Saved encounters</button>}
        {rating && (
          <span className="difficulty" title={`Encounter XP ${xp} against budgets: Low ${rating.budget.low}, Moderate ${rating.budget.moderate}, High ${rating.budget.high}`}>
            {xp} XP · <strong className={`diff ${rating.difficulty?.replace(' ', '-').toLowerCase()}`}>{rating.difficulty}</strong> for this party
          </span>
        )}
      </div>

      {(combat?.prompts ?? []).map((p) => (
        <PromptBanner key={p.id} prompt={p} combatants={combatants} settings={settings} />
      ))}

      {!started && combatants.length > 0 && !allSet && <p className="muted">Enter an initiative for everyone (typed or rolled) to start.</p>}
      {combatants.length === 0 && <p className="muted">Add your party above, then add monsters from the Bestiary tab or load a saved encounter.</p>}

      {started && combat && <TurnPanel key={`${combat.round}-${combat.turnIndex}`} combat={combat} />}

      <div className="combatants">
        {combatants.map((c, i) => (
          <CombatantRow key={c.id} c={c} active={started && i === combat?.turnIndex} image={imageFor(c)} settings={settings} />
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
        <strong>{c.name}</strong> must keep concentrating: Constitution save, DC {prompt.dc} ({formatMod(bonus)})
        <input className="narrow" type="number" placeholder="d20" value={d} onChange={(e) => setD(e.target.value)} aria-label="d20" />
        {canRoll && <button onClick={() => setD(String(rollDie(20)))}>🎲</button>}
        {total !== undefined && <span className={pass ? 'adv' : 'dis'}>{total} → {pass ? 'keeps concentrating' : 'loses concentration'}</span>}
        <button className="primary" disabled={pass === undefined} onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, !!pass), `${c.name}: concentration check`)}>
          Apply
        </button>
        <button title="Passed (advantage, a feature...)" onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, true), `${c.name}: kept concentration`)}>Passed</button>
        <button className="danger" onClick={() => mutateCombat((s) => settleConcentration(s, prompt.id, false), `${c.name}: lost concentration`)}>Failed</button>
      </div>
    )
  }
  const action = c.actions.find((a) => a.id === prompt.actionId)
  return (
    <div className="prompt-banner">
      <strong>{c.name}</strong>: roll a d6 to recharge <strong>{action?.name}</strong> ({prompt.min}{prompt.min < 6 ? '-6' : ''})
      <input className="narrow" type="number" min={1} max={6} placeholder="d6" value={d} onChange={(e) => setD(e.target.value)} aria-label="d6" />
      <button onClick={() => setD(String(rollDie(6)))}>🎲</button>
      <button className="primary" disabled={roll === undefined} onClick={() => mutateCombat((s) => settleRecharge(s, prompt.id, roll!), `${c.name}: recharge`)}>
        Apply
      </button>
      <button onClick={() => mutateCombat((s) => { s.prompts = (s.prompts ?? []).filter((x) => x.id !== prompt.id) }, 'Skipped recharge')}>Skip</button>
    </div>
  )
}

const ECON: { key: keyof TurnUsed; letter: string; title: string }[] = [
  { key: 'action', letter: 'A', title: 'Action' },
  { key: 'bonus', letter: 'B', title: 'Bonus action' },
  { key: 'reaction', letter: 'R', title: 'Reaction' },
]

function CombatantRow({ c, active, image, settings }: { c: Combatant; active: boolean; image?: Blob; settings: Settings }) {
  const [amount, setAmount] = useState('')
  const update = (fn: (c: Combatant) => void, resort = false, label?: string) =>
    mutateCombat((s) => {
      const target = s.combatants.find((x) => x.id === c.id)
      if (!target) return
      fn(target)
      if (resort) sortCombatants(s)
    }, label ?? `${c.name}: edit`)
  const amt = Number(amount)
  const withState = (fn: (s: Parameters<Parameters<typeof mutateCombat>[0]>[0], t: Combatant) => void, label: string) =>
    mutateCombat((s) => {
      const t = s.combatants.find((x) => x.id === c.id)
      if (t) fn(s, t)
    }, label)

  const toggleCondition = (cond: Condition) =>
    update((t) => {
      t.conditions = t.conditions.includes(cond) ? t.conditions.filter((x) => x !== cond) : [...t.conditions, cond]
    }, false, `${c.name}: ${cond}`)
  const pct = c.maxHp ? Math.round((c.hp / c.maxHp) * 100) : 0
  const down = c.kind !== 'lair' && c.hp === 0

  if (c.kind === 'lair') {
    return (
      <div className={`combatant lair ${active ? 'active' : ''}`}>
        <InitiativeInput value={c.initiative} onCommit={(n) => update((t) => (t.initiative = n), true, 'Lair initiative')} />
        <span />
        <div className="portrait placeholder" style={{ width: 48, height: 48, fontSize: 22 }}>☗</div>
        <div className="who">
          <strong>{c.name}</strong>
          <span className="muted">{c.notes || 'Acts on initiative 20, after everyone else on a tie'}</span>
        </div>
        <span />
        <span />
        <span />
        <button title="Remove from combat" onClick={() => mutateCombat((s) => void (s.combatants = s.combatants.filter((x) => x.id !== c.id)), 'Removed lair actions')}>✕</button>
      </div>
    )
  }

  return (
    <div className={`combatant ${c.kind} ${active ? 'active' : ''} ${down ? 'down' : ''}`}>
      <InitiativeInput value={c.initiative} onCommit={(n) => update((t) => (t.initiative = n), true, `${c.name}: initiative`)} />
      {canAppRoll(c.kind, settings) ? (
        <button title="Roll initiative" onClick={() => update((t) => (t.initiative = rollInitiative(t.initiativeBonus)), true, `${c.name}: rolled initiative`)}>
          🎲
        </button>
      ) : (
        <span title="Players roll their own initiative: type it in" />
      )}
      <Portrait name={c.name} image={image} size={48} />
      <div className="who">
        <strong>{c.name}</strong>
        <span className="muted">
          AC {c.ac}
          {(c.resistances?.length || c.immunities?.length || c.vulnerabilities?.length) ? (
            <span className="defences" title={`Resist: ${(c.resistances ?? []).join(', ') || '-'} · Immune: ${(c.immunities ?? []).join(', ') || '-'} · Vulnerable: ${(c.vulnerabilities ?? []).join(', ') || '-'}`}>
              {' '}🛡{c.resistances?.length ? ` R${c.resistances.length}` : ''}{c.immunities?.length ? ` I${c.immunities.length}` : ''}{c.vulnerabilities?.length ? ` V${c.vulnerabilities.length}` : ''}
            </span>
          ) : null}
        </span>
        {active && (
          <span className="econ">
            {ECON.map(({ key, letter, title }) => (
              <button
                key={key}
                className={`econ-pip ${c.turn?.[key] ? 'used' : ''}`}
                title={`${title}: ${c.turn?.[key] ? 'used' : 'available'} (click to toggle)`}
                onClick={() => update((t) => (t.turn = { action: false, bonus: false, reaction: false, ...t.turn, [key]: !(t.turn?.[key] ?? false) }), false, `${c.name}: ${title}`)}
              >
                {letter}
              </button>
            ))}
          </span>
        )}
        {c.legendary && <span className="muted tiny">Legendary {c.legendary.max - c.legendary.used}/{c.legendary.max}</span>}
        {c.kind === 'pc' && down && (
          <div className="saves" title="Death saves">
            <Pips label="✓" n={c.deathSaves.successes} onChange={(n) => withState((s, t) => setDeathSaves(s, t, 'successes', n), `${c.name}: death save`)} />
            <Pips label="✗" n={c.deathSaves.failures} onChange={(n) => withState((s, t) => setDeathSaves(s, t, 'failures', n), `${c.name}: death save`)} />
          </div>
        )}
      </div>

      <div className="hp">
        <div className="bar">
          <div className="fill" style={{ width: `${pct}%` }} data-low={pct <= 50} />
        </div>
        <span>
          {c.hp}/{c.maxHp}
          {c.tempHp > 0 && <em> +{c.tempHp} temp</em>}
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
              withState((s, t) => damageRow(s, t, amt), `${c.name}: damage`)
              setAmount('')
            }
          }}
        />
        <button className="danger" onClick={() => { if (amt > 0) withState((s, t) => damageRow(s, t, amt), `${c.name}: damage`); setAmount('') }}>
          Dmg
        </button>
        <button onClick={() => { if (amt > 0) withState((s, t) => healRow(s, t, amt), `${c.name}: heal`); setAmount('') }}>Heal</button>
        <button
          title="Set temp HP (kept if higher than current)"
          onClick={() => {
            if (amt > 0) update((t) => (t.tempHp = Math.max(t.tempHp, amt)), false, `${c.name}: temp HP`)
            setAmount('')
          }}
        >
          Temp
        </button>
      </div>

      <details className="conditions">
        <summary title={[...c.conditions, c.concentrating ? 'Concentrating' : ''].filter(Boolean).join(', ')}>
          {c.conditions.length ? c.conditions.join(', ') : 'Conditions'}
          {c.concentrating && ' · ◎ Concentrating'}
        </summary>
        <div className="popover">
          <label>
            <input type="checkbox" checked={c.concentrating} onChange={(e) => update((t) => (t.concentrating = e.target.checked), false, `${c.name}: concentration`)} />
            Concentrating
          </label>
          {CONDITIONS.map((cond) => (
            <label key={cond}>
              <input type="checkbox" checked={c.conditions.includes(cond)} onChange={() => toggleCondition(cond)} />
              {cond}
            </label>
          ))}
        </div>
      </details>

      <button title="Remove from combat" onClick={() => mutateCombat((s) => void (s.combatants = s.combatants.filter((x) => x.id !== c.id)), `Removed ${c.name}`)}>
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

