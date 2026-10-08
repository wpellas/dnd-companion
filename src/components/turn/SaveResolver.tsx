import { useState } from 'react'
import { autoFailsSave, saveHasDisadvantage } from '../../lib/conditionRules'
import { formatMod } from '../../lib/dice'
import { t, tAbility, tCondition, tn } from '../../lib/i18n'
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
          ? t('save.autoFailDetail', { abil: tAbility(ability), conds: r.t.conditions.map(tCondition).join('/') })
          : useLr[r.t.id]
            ? t('save.lrDetail', { abil: tAbility(ability), total: r.total ?? '', dc })
            : t('save.rollDetail', { abil: tAbility(ability), roll: r.roll ?? '', bonus: formatMod(r.bonus), total: r.total ?? '', dc })
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
        {t('save.line', { abil: tAbility(ability), dc })}
        {action.halfOnSave ? t('save.half') : hasDamage ? t('save.none') : ''}
        {action.area ? ` · ${action.area}` : ''}
      </div>

      {hasDamage && <DamageEntry entry={entry} label={t('act.damage')} canRoll={canRollDamage} />}

      <table className="save-table">
        <thead>
          <tr>
            <th>{t('save.colCreature')}</th>
            <th>{t('save.colSave', { abil: tAbility(ability) })}</th>
            <th>{t('save.colD20')}</th>
            <th>{t('save.colResult')}</th>
            {hasDamage && <th>{t('save.colTakes')}</th>}
            {action.condition && <th>{tCondition(action.condition)}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.t.id}>
              <td>
                <strong>{r.t.name}</strong>
                {r.dis && <div className="dis small">{t('save.disConditions')}</div>}
              </td>
              <td>
                {formatMod(r.bonus)}
                {(r.t.exhaustion ?? 0) > 0 && <div className="muted small">Exhaustion -{2 * (r.t.exhaustion ?? 0)}</div>}
              </td>
              <td>
                {r.auto ? (
                  <span className="muted">{t('save.autoFail')}</span>
                ) : (
                  <div className="row gap">
                    <input
                      className="narrow"
                      type="number"
                      value={d20[r.t.id] ?? ''}
                      aria-label={t('save.d20Aria', { name: r.t.name })}
                      onChange={(e) => {
                        setD20((s) => ({ ...s, [r.t.id]: e.target.value }))
                        setRollNote((s) => ({ ...s, [r.t.id]: '' }))
                      }}
                    />
                    {canRollFor(r.t) ? (
                      <button
                        title={t('save.rollTitle')}
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
                {!canRollFor(r.t) && !r.auto && <div className="muted small">{t('save.playerRolls')}</div>}
              </td>
              <td>
                {r.saved === undefined ? (
                  <span className="muted">-</span>
                ) : (
                  <span className={`save-result ${r.saved ? 'saved' : 'failed'}`}>
                    {r.saved ? t('save.saves') : t('save.fails')}
                    {r.total !== undefined && !r.auto && <small> ({r.total})</small>}
                  </span>
                )}
                {r.saved === false && r.lr && (
                  <button className="link-btn" onClick={() => setUseLr((s) => ({ ...s, [r.t.id]: true }))}>
                    {t('save.useLr', { n: r.lr.max - r.lr.used })}
                  </button>
                )}
                {useLr[r.t.id] && (
                  <button className="link-btn" onClick={() => setUseLr((s) => ({ ...s, [r.t.id]: false }))}>
                    {t('common.undo')}
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
                      <span className="muted small">{t('save.immune')}</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={cond[r.t.id] ?? true}
                        onChange={(e) => setCond((s) => ({ ...s, [r.t.id]: e.target.checked }))}
                        aria-label={t('save.applyCond', { cond: tCondition(action.condition), name: r.t.name })}
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
          {tn('save.applyTo', targets.length)}
        </button>
        {!allKnown && <span className="muted">{t('save.enterAll')}</span>}
        <span className="muted small">{attacker.name} · {action.name}</span>
      </div>
    </div>
  )
}
