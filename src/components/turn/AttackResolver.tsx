import { useState } from 'react'
import { attackAdvice, exhaustionPenalty } from '../../lib/conditionRules'
import { formatMod } from '../../lib/dice'
import { t } from '../../lib/i18n'
import { adjustForTarget } from '../../lib/resolve'
import { attackOutcome, attackRollText, rollD20, type RollMode } from '../../lib/rules'
import type { TargetOutcome } from '../../lib/combat'
import type { Action, Combatant } from '../../types'
import { Rich } from '../Rich'
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

const MODE_KEY = { normal: 'res.mode.normal', adv: 'res.mode.adv', dis: 'res.mode.dis' } as const

/** One attack: the d20 against AC (with advantage hints from conditions), then damage by type, with the target's defences applied. */
export function AttackResolver({ attacker, action, target, canRoll, onApply }: Props) {
  const melee = !/range/i.test(action.range ?? '') || /reach/i.test(action.range ?? '')
  const [within5, setWithin5] = useState(melee)
  const advice = attackAdvice(attacker, target, within5)
  const [d20, setD20] = useState('')
  const [pickedMode, setPickedMode] = useState<RollMode | null>(null)
  const [d20Note, setD20Note] = useState('')
  const mode = pickedMode ?? advice.mode // the DM can override the suggestion

  const penalty = exhaustionPenalty(attacker)
  const bonus = (action.attackBonus ?? 0) - penalty
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
    const detail = `${attackRollText({ roll, bonus, ac: target.ac, mode, exhaustion: penalty })}${advice.critOnHit && base === 'hit' ? t('res.critDetail', { why: advice.critOnHit }) : ''}`
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
          {advice.advReasons.map((r) => <div key={r} className="adv">{t('res.advLine', { why: r })}</div>)}
          {advice.disReasons.map((r) => <div key={r} className="dis">{t('res.disLine', { why: r })}</div>)}
          {advice.mode === 'normal' && advice.advReasons.length > 0 && advice.disReasons.length > 0 && (
            <div className="muted">{t('res.cancel')}</div>
          )}
          {advice.critOnHit && <div className="crit-note">{t('res.critNote', { why: advice.critOnHit })}</div>}
        </div>
      )}

      <div className="roll-line">
        <label className="field">
          <span>{t('res.d20')}</span>
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
        <span className="bonus-note">
          {t('res.toHitVs', { bonus: formatMod(bonus), ac: target.ac })}
          {penalty > 0 && t('res.exhaustion', { n: penalty })}
        </span>
        {canRoll ? (
          <>
            <select value={mode} onChange={(e) => setPickedMode(e.target.value as RollMode)} aria-label={t('res.modeAria')}>
              {(Object.keys(MODE_KEY) as RollMode[]).map((m) => (
                <option key={m} value={m}>{t(MODE_KEY[m])}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const r = rollD20(mode)
                setD20(String(r.value))
                setD20Note(r.note)
              }}
            >
              {t('res.rollToHit')}
            </button>
            {d20Note && <span className="roll-note">{d20Note}</span>}
          </>
        ) : (
          <span className="roll-hint">
            {mode === 'adv' ? t('res.hintAdv') : mode === 'dis' ? t('res.hintDis') : t('res.hintTable')}
            {t('res.hintEnter')}
          </span>
        )}
      </div>

      <div className="outcome-line">
        <label className="check small" title={t('res.within5Title')}>
          <input type="checkbox" checked={within5} onChange={(e) => setWithin5(e.target.checked)} />
          <span>{t('res.within5')}</span>
        </label>
        {outcome && <div className={`outcome ${outcome}`}>{outcome === 'crit' ? t('res.crit') : outcome === 'hit' ? t('res.hit') : t('res.miss')}</div>}
      </div>

      {hit && hasDamage && (
        <>
          <DamageEntry entry={entry} label={t('act.damage')} canRoll={canRoll} crit={outcome === 'crit'} />
          {entry.out.length > 0 && entry.complete && (
            <div className="applied">
              <Rich text={t('res.takes', { name: target.name })} parts={{ n: <strong>{adjusted.total}</strong> }} />
              {adjusted.notes.length > 0 && <span className="muted"> ({adjusted.notes.join('; ')})</span>}
            </div>
          )}
        </>
      )}

      <div className="row gap">
        <button className="primary" disabled={!canApply} onClick={apply}>
          {outcome === 'miss' ? t('res.logMiss') : hit && hasDamage ? t('res.applyDamage', { n: adjusted.total }) : t('res.apply')}
        </button>
      </div>
    </div>
  )
}
