import { Fragment, useState } from 'react'
import { applyLongRest, applyShortRest } from '../lib/store'
import { useSettings } from '../lib/settings'
import { hitDiceRemaining, longRestHitDice, rollHitDice, shortRestRecharges, shortRestRecoveries, slotLevelsChosen, type Recovery, type RecoveryChoice } from '../lib/rest'
import type { Character } from '../types'

interface Props {
  kind: 'short' | 'long'
  characters: Character[]
  onClose: () => void
}

/** Rest dialog: pick who rests, then (short rest) spend hit dice with typed or rolled healing. */
export function RestPanel({ kind, characters, onClose }: Props) {
  const settings = useSettings()
  const [included, setIncluded] = useState(() => new Set(characters.map((c) => c.id!)))
  const [spend, setSpend] = useState<Record<number, number>>({})
  const [healed, setHealed] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [recover, setRecover] = useState<Record<number, RecoveryChoice | undefined>>({})

  const toggle = (id: number) =>
    setIncluded((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const roll = (c: Character) => {
    const n = spend[c.id!] ?? 0
    const r = rollHitDice(c, n)
    setHealed((h) => ({ ...h, [c.id!]: String(r.total) }))
    setNotes((m) => ({ ...m, [c.id!]: `d${c.hitDie}: [${r.rolls.join(', ')}] ${r.con >= 0 ? '+' : ''}${r.con} CON each` }))
  }

  const apply = async () => {
    const ids = characters.filter((c) => included.has(c.id!)).map((c) => c.id!)
    if (kind === 'long') {
      await applyLongRest(ids)
    } else {
      await applyShortRest(
        ids.map((id) => ({ id, hitDiceSpent: spend[id] ?? 0, hpRegained: Number(healed[id]) || 0, recover: recover[id] })),
      )
    }
    onClose()
  }

  return (
    <div className="card rest-panel">
      <h3>{kind === 'short' ? '☾ Short rest' : '☀ Long rest'}</h3>
      <p className="muted">
        {kind === 'short'
          ? `About an hour. Spend Hit Dice to heal (${settings.allowPlayerAppRolls ? 'roll them here or type what the players rolled' : 'the players roll their own dice - type the total they rolled'}). Short-rest features recharge, Warlocks regain their Pact Magic slots, and Arcane Recovery-style features can give slots back.`
          : 'About eight hours. Everyone regains all Hit Points, half their Hit Dice (minimum 1), all spell slots and all feature uses, and loses one Exhaustion level.'}
      </p>
      <table>
        <thead>
          <tr>
            <th />
            <th>Character</th>
            <th>HP</th>
            <th>Hit dice</th>
            {kind === 'short' ? (
              <>
                <th>Spend</th>
                <th>HP regained</th>
              </>
            ) : (
              <th>Recovers</th>
            )}
          </tr>
        </thead>
        <tbody>
          {characters.map((c) => {
            const id = c.id!
            const left = hitDiceRemaining(c)
            const on = included.has(id)
            const recoveries = kind === 'short' && on ? shortRestRecoveries(c) : []
            return (
              <Fragment key={id}>
              <tr className={on ? '' : 'off'}>
                <td>
                  <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                </td>
                <td>{c.name}</td>
                <td>
                  {c.currentHp}/{c.maxHp}
                </td>
                <td>
                  {left}/{c.level} d{c.hitDie}
                </td>
                {kind === 'short' ? (
                  <>
                    <td>
                      <input
                        className="narrow"
                        type="number"
                        min={0}
                        max={left}
                        disabled={!on || left === 0}
                        value={spend[id] ?? 0}
                        onChange={(e) =>
                          setSpend((s) => ({ ...s, [id]: Math.max(0, Math.min(left, Math.floor(e.target.valueAsNumber) || 0)) }))
                        }
                      />
                    </td>
                    <td>
                      <div className="row gap">
                        <input
                          className="narrow"
                          type="number"
                          min={0}
                          disabled={!on}
                          value={healed[id] ?? ''}
                          placeholder="0"
                          onChange={(e) => setHealed((h) => ({ ...h, [id]: e.target.value }))}
                        />
                        {settings.allowPlayerAppRolls && (
                          <button disabled={!on || !(spend[id] > 0)} onClick={() => roll(c)}>
                            🎲
                          </button>
                        )}
                        {notes[id] && <span className="muted">{notes[id]}</span>}
                        {on && shortRestRecharges(c).length > 0 && (
                          <span className="muted">↻ {shortRestRecharges(c).join(', ')}</span>
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  <td className="muted">
                    +{Math.min(longRestHitDice(c), c.hitDiceUsed ?? 0)} hit dice, HP {c.maxHp - c.currentHp > 0 ? `+${c.maxHp - c.currentHp}` : 'full'}
                    {(c.exhaustion ?? 0) > 0 && `, Exhaustion ${c.exhaustion} → ${(c.exhaustion ?? 0) - 1}`}
                  </td>
                )}
              </tr>
              {recoveries.map((r) => (
                <tr className="recovery-row" key={r.featureId}>
                  <td />
                  <td colSpan={5}>
                    <RecoveryPicker c={c} r={r} choice={recover[id]?.featureId === r.featureId ? recover[id] : undefined} onChange={(ch) => setRecover((m) => ({ ...m, [id]: ch }))} />
                  </td>
                </tr>
              ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <div className="row gap">
        <button className="primary" disabled={included.size === 0} onClick={apply}>
          {kind === 'short' ? 'Take short rest' : 'Take long rest'}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

/** Pick which spent slots (or sorcery points) a short-rest feature gives back, within the feature's budget. */
function RecoveryPicker({ c, r, choice, onChange }: { c: Character; r: Recovery; choice?: RecoveryChoice; onChange: (c: RecoveryChoice | undefined) => void }) {
  const used = r.kind === 'slots' ? slotLevelsChosen(choice?.slots) : (choice?.points ?? 0)
  const left = r.budget - used
  const sc = c.spellcasting
  const set = (next: RecoveryChoice) => onChange((next.slots ?? []).some((k) => k > 0) || (next.points ?? 0) > 0 ? next : undefined)

  return (
    <div className="recovery">
      <strong>{r.name}</strong>
      <span className="muted">
        {r.kind === 'slots' ? `recover slots worth up to ${r.budget} level${r.budget === 1 ? '' : 's'} (none above ${r.maxSlotLevel}th)` : `regain up to ${r.budget} Sorcery Point${r.budget === 1 ? '' : 's'}`}
        {' · '}
        {left} left
      </span>
      {r.kind === 'slots' &&
        sc?.slots.slice(0, r.maxSlotLevel).map((s, i) => {
          const level = i + 1
          if (s.used === 0) return null
          const n = choice?.slots?.[i] ?? 0
          const change = (d: number) => {
            const slots = Array.from({ length: 9 }, (_, k) => choice?.slots?.[k] ?? 0)
            slots[i] = n + d
            set({ featureId: r.featureId, slots })
          }
          return (
            <span className="slot-step" key={level}>
              Level {level}
              <button aria-label={`Recover fewer level ${level} slots`} disabled={n === 0} onClick={() => change(-1)}>−</button>
              <strong>{n}</strong>
              <button aria-label={`Recover a level ${level} slot`} disabled={n >= s.used || level > left} onClick={() => change(1)}>+</button>
              <span className="muted">of {s.used} spent</span>
            </span>
          )
        })}
      {r.kind === 'points' && (
        <input
          className="narrow"
          type="number"
          min={0}
          max={r.budget}
          aria-label="Sorcery Points to regain"
          value={choice?.points ?? 0}
          onChange={(e) => set({ featureId: r.featureId, points: Math.max(0, Math.min(r.budget, Math.floor(e.target.valueAsNumber) || 0)) })}
        />
      )}
    </div>
  )
}
