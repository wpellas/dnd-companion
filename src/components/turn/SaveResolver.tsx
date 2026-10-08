import { useState } from 'react'
import { autoFailsSave, saveHasDisadvantage } from '../../lib/conditionRules'
import { formatMod } from '../../lib/dice'
import { adjustForTarget, saveBonus } from '../../lib/resolve'
import { rollD20 } from '../../lib/rules'
import type { TargetOutcome } from '../../lib/combat'
import type { Action, Combatant } from '../../types'
import { DamageEntry } from './DamageEntry'
import { useDamageEntry } from './useDamageEntry'

interface Props {
  attacker: Combatant
  action: Action
  targets: Combatant[]
  /** May the app roll for this creature? (monsters: yes, players: only if the setting allows) */
  canRollFor: (c: Combatant) => boolean
  /** May the app roll the damage (the attacker's dice)? */
  canRollDamage: boolean
  onApply: (outcomes: TargetOutcome[], detail: string) => void
}

const lrCounter = (c: Combatant) => (c.counters ?? []).find((k) => /legendary resistance/i.test(k.name) && k.used < k.max)

/**
 * A saving-throw effect against one or more creatures. Everyone saves against the same DC and takes the same
 * damage roll (rolled once), adjusted for half-on-save and each creature's resistances. Players' d20s are always typed;
 * the app only supplies their bonus and compares the total with the DC.
 */
export function SaveResolver({ attacker, action, targets, canRollFor, canRollDamage, onApply }: Props) {
  const ability = action.saveAbility ?? 'dex'
  const dc = action.saveDc ?? 10
  const [d20, setD20] = useState<Record<string, string>>({})
  const [rollNote, setRollNote] = useState<Record<string, string>>({})
  const [useLr, setUseLr] = useState<Record<string, boolean>>({})
  const [cond, setCond] = useState<Record<string, boolean>>({})
  const entry = useDamageEntry(action, { crit: false, advantage: false })
  const hasDamage = entry.parts.length > 0

  const rows = targets.map((t) => {
    const auto = autoFailsSave(t, ability)
    const roll = d20[t.id] === undefined || d20[t.id] === '' ? undefined : Number(d20[t.id])
    const bonus = saveBonus(t, ability)
    const total = roll === undefined ? undefined : roll + bonus
    let saved: boolean | undefined = auto ? false : total === undefined ? undefined : total >= dc
    if (saved === false && useLr[t.id]) saved = true
    const adjusted = saved === undefined ? undefined : adjustForTarget(entry.out, t, saved ? (action.halfOnSave ? 'half' : 'none') : undefined)
    return { t, auto, roll, bonus, total, saved, adjusted, dis: saveHasDisadvantage(t, ability), lr: lrCounter(t) }
  })
  const allKnown = rows.every((r) => r.saved !== undefined)
  const canApply = allKnown && (!hasDamage || entry.complete)

  const apply = () => {
    onApply(
      rows.map((r): TargetOutcome => {
        const how = r.auto
          ? `${ability.toUpperCase()} save fails automatically (${r.t.conditions.join('/')})`
          : useLr[r.t.id]
            ? `${ability.toUpperCase()} save ${r.total} vs DC ${dc} - uses Legendary Resistance`
            : `${ability.toUpperCase()} save ${r.roll} ${formatMod(r.bonus)} = ${r.total} vs DC ${dc}`
        return {
          targetId: r.t.id,
          result: r.saved ? 'saved' : 'failed',
          parts: r.adjusted?.parts ?? [],
          applyCondition: cond[r.t.id] ?? true,
          detail: how,
          notes: r.adjusted?.notes ?? [],
          spendCounter: useLr[r.t.id] ? r.lr?.id : undefined,
        }
      }),
      entry.detail,
    )
  }

  return (
    <div className="resolve">
      <div className="muted">
        {ability.toUpperCase()} saving throw, DC {dc}
        {action.halfOnSave ? ' (half damage on a success)' : hasDamage ? ' (no damage on a success)' : ''}
        {action.area ? ` · ${action.area}` : ''}
      </div>

      {hasDamage && <DamageEntry entry={entry} label="Damage" canRoll={canRollDamage} />}

      <table className="save-table">
        <thead>
          <tr>
            <th>Creature</th>
            <th>{ability.toUpperCase()} save</th>
            <th>d20</th>
            <th>Result</th>
            {hasDamage && <th>Takes</th>}
            {action.condition && <th>{action.condition}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.t.id}>
              <td>
                <strong>{r.t.name}</strong>
                {r.dis && <div className="dis small">Disadvantage (conditions)</div>}
              </td>
              <td>
                {formatMod(r.bonus)}
                {(r.t.exhaustion ?? 0) > 0 && <div className="muted small">Exhaustion -{2 * (r.t.exhaustion ?? 0)}</div>}
              </td>
              <td>
                {r.auto ? (
                  <span className="muted">auto-fail</span>
                ) : (
                  <div className="row gap">
                    <input
                      className="narrow"
                      type="number"
                      value={d20[r.t.id] ?? ''}
                      aria-label={`${r.t.name} d20`}
                      onChange={(e) => {
                        setD20((s) => ({ ...s, [r.t.id]: e.target.value }))
                        setRollNote((s) => ({ ...s, [r.t.id]: '' }))
                      }}
                    />
                    {canRollFor(r.t) ? (
                      <button
                        title="Roll for this creature (the DM's dice)"
                        onClick={() => {
                          const v = rollD20(r.dis ? 'dis' : 'normal')
                          setD20((s) => ({ ...s, [r.t.id]: String(v.value) }))
                          setRollNote((s) => ({ ...s, [r.t.id]: v.note }))
                        }}
                      >
                        🎲
                      </button>
                    ) : null}
                  </div>
                )}
                {rollNote[r.t.id] && <div className="muted small">{rollNote[r.t.id]}</div>}
                {!canRollFor(r.t) && !r.auto && <div className="muted small">player rolls</div>}
              </td>
              <td>
                {r.saved === undefined ? (
                  <span className="muted">-</span>
                ) : (
                  <span className={`save-result ${r.saved ? 'saved' : 'failed'}`}>
                    {r.saved ? 'SAVES' : 'FAILS'}
                    {r.total !== undefined && !r.auto && <small> ({r.total})</small>}
                  </span>
                )}
                {r.saved === false && r.lr && (
                  <button className="link-btn" onClick={() => setUseLr((s) => ({ ...s, [r.t.id]: true }))}>
                    Use Legendary Resistance ({r.lr.max - r.lr.used} left)
                  </button>
                )}
                {useLr[r.t.id] && (
                  <button className="link-btn" onClick={() => setUseLr((s) => ({ ...s, [r.t.id]: false }))}>
                    undo
                  </button>
                )}
              </td>
              {hasDamage && (
                <td>
                  {r.adjusted && entry.complete ? (
                    <>
                      <strong>{r.adjusted.total}</strong>
                      {r.adjusted.notes.length > 0 && <div className="muted small">{r.adjusted.notes.join('; ')}</div>}
                    </>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              )}
              {action.condition && (
                <td>
                  {r.saved === false ? (
                    r.t.conditionImmunities?.includes(action.condition) ? (
                      <span className="muted small">immune</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={cond[r.t.id] ?? true}
                        onChange={(e) => setCond((s) => ({ ...s, [r.t.id]: e.target.checked }))}
                        aria-label={`Apply ${action.condition} to ${r.t.name}`}
                      />
                    )
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row gap">
        <button className="primary" disabled={!canApply} onClick={apply}>
          Apply to {targets.length} {targets.length === 1 ? 'creature' : 'creatures'}
        </button>
        {!allKnown && <span className="muted">Enter every d20 to continue.</span>}
        <span className="muted small">{attacker.name} · {action.name}</span>
      </div>
    </div>
  )
}
