import { Fragment, useState } from 'react'
import { t, tn } from '../lib/i18n'
import { levelLabel } from '../lib/spells'
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
    setNotes((m) => ({ ...m, [c.id!]: t('rest.rollNote', { die: c.hitDie, rolls: r.rolls.join(', '), con: `${r.con >= 0 ? '+' : ''}${r.con}` }) }))
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
      <h3>{kind === 'short' ? t('rest.short') : t('rest.long')}</h3>
      <p className="muted">
        {kind === 'short'
          ? t('rest.shortIntro', { how: t(settings.allowPlayerAppRolls ? 'rest.howRoll' : 'rest.howType') })
          : t('rest.longIntro')}
      </p>
      <table>
        <thead>
          <tr>
            <th />
            <th>{t('rest.colCharacter')}</th>
            <th>{t('rest.colHp')}</th>
            <th>{t('rest.colHitDice')}</th>
            {kind === 'short' ? (
              <>
                <th>{t('rest.colSpend')}</th>
                <th>{t('rest.colRegained')}</th>
              </>
            ) : (
              <th>{t('rest.colRecovers')}</th>
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
                    {t('rest.longRecovers', { n: Math.min(longRestHitDice(c), c.hitDiceUsed ?? 0), hp: c.maxHp - c.currentHp > 0 ? `+${c.maxHp - c.currentHp}` : t('rest.full') })}
                    {(c.exhaustion ?? 0) > 0 && t('rest.exhaustDrop', { a: c.exhaustion ?? 0, b: (c.exhaustion ?? 0) - 1 })}
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
          {kind === 'short' ? t('rest.takeShort') : t('rest.takeLong')}
        </button>
        <button onClick={onClose}>{t('common.cancel')}</button>
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
        {r.kind === 'slots' ? tn('rest.recSlots', r.budget, { max: levelLabel(r.maxSlotLevel) }) : tn('rest.recPoints', r.budget)}
        {' · '}
        {t('rest.leftN', { n: left })}
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
              {t('rest.levelN', { n: level })}
              <button aria-label={t('rest.fewer', { n: level })} disabled={n === 0} onClick={() => change(-1)}>−</button>
              <strong>{n}</strong>
              <button aria-label={t('rest.recoverOne', { n: level })} disabled={n >= s.used || level > left} onClick={() => change(1)}>+</button>
              <span className="muted">{t('rest.ofSpent', { n: s.used })}</span>
            </span>
          )
        })}
      {r.kind === 'points' && (
        <input
          className="narrow"
          type="number"
          min={0}
          max={r.budget}
          aria-label={t('rest.pointsAria')}
          value={choice?.points ?? 0}
          onChange={(e) => set({ featureId: r.featureId, points: Math.max(0, Math.min(r.budget, Math.floor(e.target.valueAsNumber) || 0)) })}
        />
      )}
    </div>
  )
}
