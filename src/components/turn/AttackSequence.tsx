import { useState } from 'react'
import type { TargetOutcome } from '../../lib/combat'
import { formatMod, rollDice } from '../../lib/dice'
import { RIDER_NOTE } from '../../lib/monsters'
import { t, tDamage, tn } from '../../lib/i18n'
import { rollD20 } from '../../lib/rules'
import { evaluateRow, newRow, type RowState, type Step } from '../../lib/volley'
import type { Combatant } from '../../types'
import { Combobox } from '../Combobox'

interface Props {
  attacker: Combatant
  steps: Step[]
  /** Creatures that can be attacked (not the attacker) */
  pickable: Combatant[]
  /** May the app roll for the attacker (monsters: yes; players only if the setting allows) */
  canRoll: boolean
  /** Starts with the "within 5 ft" box ticked (melee attacks) */
  melee: boolean
  onApply: (outcomes: TargetOutcome[], detail: string) => void
}

const OUTCOME_LABEL = { crit: 'seq.crit', hit: 'res.hit', miss: 'res.miss' } as const

/**
 * A run of separate attacks, each with its own target, d20 and damage: the rays of Scorching Ray, darts of Magic Missile,
 * beams of Eldritch Blast, or a monster's Multiattack. Players' dice are typed in; the app rolls only for monsters (or
 * players when that setting is on). One Apply logs every attack and resolves them in order.
 */
export function AttackSequence({ attacker, steps: initial, pickable, canRoll, melee, onApply }: Props) {
  const [steps, setSteps] = useState(initial)
  const [rows, setRows] = useState<RowState[]>(() => initial.map(newRow))
  const [within5, setWithin5] = useState(melee)
  const [rollNotes, setRollNotes] = useState<Record<number, string>>({})

  const patch = (i: number, p: Partial<RowState>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...p } : r)))
  const targetOf = (r: RowState) => pickable.find((c) => c.id === r.targetId)
  const results = rows.map((r, i) => evaluateRow(r, steps[i], attacker, targetOf(r), within5))
  const allDone = results.every((r) => r.complete)
  const total = results.reduce((n, r) => n + (r.adjusted?.total ?? 0), 0)

  const options = pickable.map((c) => ({
    value: c.id,
    label: c.name,
    group: c.kind === 'pc' ? t('turn.groupParty') : t('turn.groupEnemies'),
    hint: `${t('turn.targetHint', { ac: c.ac, hp: c.hp, max: c.maxHp })}${c.hp === 0 ? t('turn.down') : ''}`,
  }))

  /** Roll one attack for the app-rolled creature: the d20 (with the advantage the conditions give), then damage (dice doubled on a crit). */
  const rollRow = (i: number) => {
    const row = rows[i]
    const step = steps[i]
    const target = targetOf(row)
    if (!target) return
    const first = evaluateRow(row, step, attacker, target, within5)
    const mode = first.advice?.mode ?? 'normal'
    const d = step.autoHit ? undefined : rollD20(mode)
    const next: RowState = { ...row, d20: d ? String(d.value) : row.d20, amounts: {}, extras: row.extras }
    const second = evaluateRow(next, step, attacker, target, within5)
    const notes: string[] = []
    if (d) notes.push(d.note)
    if (second.hit) {
      const crit = second.outcome === 'crit'
      second.parts.forEach((p, k) => {
        if (!second.included[k]) return
        const r = rollDice(p.dice, crit)
        if (r) {
          next.amounts[k] = String(r.total)
          notes.push(`${p.dice} ${r.note}`)
        }
      })
    }
    patch(i, next)
    setRollNotes((n) => ({ ...n, [i]: notes.join('; ') }))
  }

  const apply = () => {
    const outcomes = results.map((r, i): TargetOutcome => ({
      targetId: rows[i].targetId!,
      result: r.outcome!,
      parts: r.hit ? (r.adjusted?.parts ?? []) : [],
      applyCondition: true,
      detail: [r.detail, rollNotes[i] && r.hit ? rollNotes[i] : ''].filter(Boolean).join('; '),
      notes: r.hit ? (r.adjusted?.notes ?? []) : [],
      action: r.action,
    }))
    onApply(outcomes, tn('seq.detail', rows.length))
  }

  return (
    <div className="resolve volley">
      <div className="row gap wrap">
        <div className="field">
          <span>{t('seq.aimAll')}</span>
          <Combobox
            className="target-select"
            placeholder={t('seq.aimPlaceholder')}
            options={options}
            onChange={(id) => id && setRows((rs) => rs.map((r) => ({ ...r, targetId: id })))}
          />
        </div>
        <label className="check small" title={t('res.within5Title')}>
          <input type="checkbox" checked={within5} onChange={(e) => setWithin5(e.target.checked)} />
          <span>{t('res.within5')}</span>
        </label>
        {canRoll && (
          <button disabled={rows.some((r) => !r.targetId)} onClick={() => rows.forEach((_, i) => rollRow(i))} title={t('seq.rollAllTitle')}>
            {t('seq.rollAll')}
          </button>
        )}
      </div>

      <table className="save-table volley-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('seq.colAttack')}</th>
            <th>{t('seq.colTarget')}</th>
            <th>{t('res.colD20')}</th>
            <th>{t('save.colResult')}</th>
            <th>{t('seq.colDamage')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const r = results[i]
            const step = steps[i]
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  {step.actions.length > 1 ? (
                    <select value={row.actionIndex} aria-label={t('seq.actionAria', { n: i + 1 })} onChange={(e) => patch(i, { actionIndex: Number(e.target.value), amounts: {}, extras: {} })}>
                      {step.actions.map((a, k) => (
                        <option key={a.id} value={k}>{a.name}</option>
                      ))}
                    </select>
                  ) : (
                    <strong>{r.action.name}</strong>
                  )}
                  <div className="muted small">{step.autoHit ? t('seq.autoHit') : t('seq.toHit', { bonus: formatMod(r.bonus) })}</div>
                </td>
                <td>
                  <Combobox
                    className="target-select"
                    placeholder={t('seq.targetPlaceholder')}
                    value={row.targetId}
                    options={options}
                    onChange={(id) => patch(i, { targetId: id })}
                  />
                  {r.advice && r.advice.mode !== 'normal' && (
                    <div className={`small ${r.advice.mode === 'adv' ? 'adv' : 'dis'}`} title={[...r.advice.advReasons, ...r.advice.disReasons].join('; ')}>
                      {r.advice.mode === 'adv' ? t('seq.adv') : t('seq.dis')}
                    </div>
                  )}
                </td>
                <td>
                  {step.autoHit ? (
                    <span className="muted">-</span>
                  ) : (
                    <input className="narrow" type="number" aria-label={t('seq.attackAria', { n: i + 1 })} value={row.d20} onChange={(e) => patch(i, { d20: e.target.value })} />
                  )}
                </td>
                <td>
                  {r.outcome ? <span className={`outcome-chip ${r.outcome}`}>{t(OUTCOME_LABEL[r.outcome])}</span> : <span className="muted">-</span>}
                </td>
                <td>
                  {r.hit && r.parts.length > 0 ? (
                    <div className="row gap wrap">
                      {r.parts.map((p, k) => (
                        <div className="part" key={k}>
                          {p.note && (
                            <label className="check small" title={t('de.onlyIf', { note: p.note === RIDER_NOTE ? t('de.rider') : p.note })}>
                              <input type="checkbox" checked={r.included[k]} onChange={(e) => patch(i, { extras: { ...row.extras, [k]: e.target.checked } })} />
                              <span>{t('seq.ifNote', { note: p.note === RIDER_NOTE ? t('de.rider') : p.note })}</span>
                            </label>
                          )}
                          <input
                            className="narrow"
                            type="number"
                            min={0}
                            disabled={!r.included[k]}
                            placeholder={p.dice}
                            aria-label={t('seq.damageAria', { n: i + 1, type: p.type || 'damage' })}
                            value={row.amounts[k] ?? ''}
                            onChange={(e) => patch(i, { amounts: { ...row.amounts, [k]: e.target.value } })}
                          />
                          <small className="muted">{p.type ? tDamage(p.type) : t('de.untyped')}</small>
                        </div>
                      ))}
                      {r.adjusted && r.adjusted.notes.length > 0 && <span className="muted small">{r.adjusted.notes.join('; ')}</span>}
                    </div>
                  ) : (
                    <span className="muted">{r.outcome === 'miss' ? t('seq.noDamage') : r.parts.length ? '' : t('seq.noDamageRoll')}</span>
                  )}
                  {rollNotes[i] && <div className="muted small">{rollNotes[i]}</div>}
                </td>
                <td>
                  <div className="row gap">
                    {canRoll && (
                      <button title={t('seq.rollThis')} disabled={!row.targetId} onClick={() => rollRow(i)}>
                        🎲
                      </button>
                    )}
                    <button
                      title={t('seq.skip')}
                      aria-label={t('seq.removeAria', { n: i + 1 })}
                      disabled={rows.length === 1}
                      onClick={() => {
                        setRows((rs) => rs.filter((_, k) => k !== i))
                        setSteps((ss) => ss.filter((_, k) => k !== i))
                        setRollNotes({})
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!canRoll && (
        <div className="muted roll-hint">{t('seq.tableHint')}</div>
      )}

      <div className="row gap">
        <button className="primary" disabled={!allDone} onClick={apply}>
          {tn('seq.apply', rows.length)}
          {allDone && total > 0 ? t('seq.applyDamage', { n: total }) : ''}
        </button>
        {!allDone && <span className="muted">{t('seq.needAll')}</span>}
      </div>
    </div>
  )
}
