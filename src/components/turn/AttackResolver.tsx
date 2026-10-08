import { useState } from 'react'
import { attackAdvice } from '../../lib/conditionRules'
import { formatMod } from '../../lib/dice'
import { adjustForTarget } from '../../lib/resolve'
import { attackOutcome, rollD20, type RollMode } from '../../lib/rules'
import type { TargetOutcome } from '../../lib/combat'
import type { Action, Combatant } from '../../types'
import { DamageEntry } from './DamageEntry'
import { useDamageEntry } from './useDamageEntry'

interface Props {
  attacker: Combatant
  action: Action
  target: Combatant
  /** May the app roll for the attacker (monsters always; players only if the setting allows it)? */
  canRoll: boolean
  onApply: (outcomes: TargetOutcome[], detail: string) => void
}

const MODE_LABEL: Record<RollMode, string> = { normal: 'Normal', adv: 'Advantage', dis: 'Disadvantage' }

/** One attack: the d20 against AC (with advantage hints from conditions), then damage by type, with the target's defences applied. */
export function AttackResolver({ attacker, action, target, canRoll, onApply }: Props) {
  const melee = !/range/i.test(action.range ?? '') || /reach/i.test(action.range ?? '')
  const [within5, setWithin5] = useState(melee)
  const advice = attackAdvice(attacker, target, within5)
  const [d20, setD20] = useState('')
  const [pickedMode, setPickedMode] = useState<RollMode | null>(null)
  const [d20Note, setD20Note] = useState('')
  const mode = pickedMode ?? advice.mode // the DM can override the suggestion

  const bonus = action.attackBonus ?? 0
  const roll = d20 === '' ? undefined : Number(d20)
  const base = roll === undefined ? null : attackOutcome(roll, bonus, target.ac)
  // a hit that the rules turn into a crit (Paralyzed / Unconscious target within 5 ft)
  const outcome = base === 'hit' && advice.critOnHit ? 'crit' : base
  const hit = outcome === 'hit' || outcome === 'crit'
  const entry = useDamageEntry(action, { crit: outcome === 'crit', advantage: mode === 'adv' })
  const hasDamage = entry.parts.length > 0

  const adjusted = adjustForTarget(entry.out, target)
  const canApply = outcome !== null && (!hit || !hasDamage || entry.complete)

  const apply = () => {
    if (!outcome) return
    const detail = `d20 ${roll} ${formatMod(bonus)} = ${(roll ?? 0) + bonus} vs AC ${target.ac}${mode !== 'normal' ? ` (${MODE_LABEL[mode].toLowerCase()})` : ''}${advice.critOnHit && base === 'hit' ? ` - crit: ${advice.critOnHit}` : ''}`
    onApply(
      [
        {
          targetId: target.id,
          result: outcome,
          parts: hit ? adjusted.parts : [],
          applyCondition: true,
          detail: [detail, hit ? entry.detail : ''].filter(Boolean).join('; '),
          notes: hit ? adjusted.notes : [],
        },
      ],
      '',
    )
  }

  return (
    <div className="resolve">
      {(advice.advReasons.length > 0 || advice.disReasons.length > 0 || advice.critOnHit) && (
        <div className="advice">
          {advice.advReasons.map((r) => <div key={r} className="adv">▲ Advantage: {r}</div>)}
          {advice.disReasons.map((r) => <div key={r} className="dis">▼ Disadvantage: {r}</div>)}
          {advice.mode === 'normal' && advice.advReasons.length > 0 && advice.disReasons.length > 0 && (
            <div className="muted">They cancel out: roll normally.</div>
          )}
          {advice.critOnHit && <div className="crit-note">★ Any hit is a Critical Hit: {advice.critOnHit}</div>}
        </div>
      )}

      <div className="row gap wrap">
        <label className="field">
          <span>d20 roll</span>
          <input
            className="narrow"
            type="number"
            value={d20}
            onChange={(e) => {
              setD20(e.target.value)
              setD20Note('')
            }}
            autoFocus
          />
        </label>
        <span className="muted bonus-note">
          {formatMod(bonus)} to hit vs AC {target.ac}
        </span>
        {canRoll ? (
          <>
            <select value={mode} onChange={(e) => setPickedMode(e.target.value as RollMode)} aria-label="Roll mode">
              {(Object.keys(MODE_LABEL) as RollMode[]).map((m) => (
                <option key={m} value={m}>{MODE_LABEL[m]}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const r = rollD20(mode)
                setD20(String(r.value))
                setD20Note(r.note)
              }}
            >
              🎲 Roll to hit
            </button>
            {d20Note && <span className="muted">{d20Note}</span>}
          </>
        ) : (
          <span className="muted roll-hint">
            {mode === 'adv' ? 'Rolled with Advantage' : mode === 'dis' ? 'Rolled with Disadvantage' : 'Rolled at the table'}: enter the d20 that counts
          </span>
        )}
        <label className="check small" title="Needed for Prone targets and the auto-crit rules">
          <input type="checkbox" checked={within5} onChange={(e) => setWithin5(e.target.checked)} />
          <span>Attacker within 5 ft</span>
        </label>
      </div>

      {outcome && <div className={`outcome ${outcome}`}>{outcome === 'crit' ? 'CRITICAL HIT' : outcome === 'hit' ? 'HIT' : 'MISS'}</div>}

      {hit && hasDamage && (
        <>
          <DamageEntry entry={entry} label="Damage" canRoll={canRoll} crit={outcome === 'crit'} />
          {entry.out.length > 0 && entry.complete && (
            <div className="applied">
              {target.name} takes <strong>{adjusted.total}</strong>
              {adjusted.notes.length > 0 && <span className="muted"> ({adjusted.notes.join('; ')})</span>}
            </div>
          )}
        </>
      )}

      <div className="row gap">
        <button className="primary" disabled={!canApply} onClick={apply}>
          {outcome === 'miss' ? 'Log miss' : hit && hasDamage ? `Apply ${adjusted.total} damage` : 'Apply'}
        </button>
      </div>
    </div>
  )
}
