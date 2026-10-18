import { dash, disengage, isDown, moveFeet, mutateCombat, opportunityAttack, standUp } from '../lib/combat'
import { isIncapacitated } from '../lib/conditionRules'
import { isParty } from '../lib/sides'
import { effectiveSpeed, movementLeft } from '../lib/conditionRules'
import { t } from '../lib/i18n'
import type { Combatant } from '../types'

/** Movement without a map: the DM counts the feet the creature walks this turn. Dash and Disengage are actions; the app reminds about opportunity attacks. */
export function MovementBar({ c, all, onReact }: { c: Combatant; all: Combatant[]; onReact: (reactorId: string) => void }) {
  const speed = effectiveSpeed(c)
  const left = movementLeft(c)
  if (speed === undefined || left === undefined) return null
  const total = speed * (1 + (c.turn?.dashes ?? 0))
  const prone = c.conditions.includes('Prone')
  // who could take an opportunity attack: the other side, up, able to act, Reaction unspent (there are no positions: the DM knows who was in reach)
  const reactors = all.filter((x) => x.kind !== 'lair' && isParty(x) !== isParty(c) && !isDown(x) && !isIncapacitated(x) && !x.turn?.reaction)
  const act = (fn: (s: Parameters<Parameters<typeof mutateCombat>[0]>[0], who: Combatant) => void, label: string) =>
    void mutateCombat((s) => {
      const who = s.combatants.find((x) => x.id === c.id)
      if (who) fn(s, who)
    }, label)

  return (
    <div className="movement">
      <span className="chip" title={t('move.title')}>
        {t('move.line', { used: c.turn?.moved ?? 0, total })}
      </span>
      <button aria-label={t('move.less')} disabled={!(c.turn?.moved ?? 0)} onClick={() => act((s, who) => moveFeet(s, who, -5), t('lbl.move', { name: c.name }))}>−5</button>
      <button aria-label={t('move.more')} onClick={() => act((s, who) => moveFeet(s, who, 5), t('lbl.move', { name: c.name }))}>+5</button>
      <button disabled={!!c.turn?.action} title={t('move.dashTitle')} onClick={() => act((s, who) => dash(s, who), t('lbl.move', { name: c.name }))}>{t('move.dash')}</button>
      <button disabled={!!c.turn?.action || !!c.turn?.disengaged} title={t('move.disengageTitle')} onClick={() => act((s, who) => disengage(s, who), t('lbl.move', { name: c.name }))}>{t('move.disengage')}</button>
      {prone && (
        <button disabled={speed === 0 || left < Math.floor(speed / 2)} title={t('move.standTitle', { ft: Math.floor(speed / 2) })} onClick={() => act((s, who) => standUp(s, who), t('lbl.move', { name: c.name }))}>
          {t('move.stand')}
        </button>
      )}
      {left < 0 && <span className="warn small">{t('move.over', { n: -left })}</span>}
      {!c.turn?.disengaged && (c.turn?.moved ?? 0) > 0 && <span className="muted small">{t('move.oa')}</span>}
      {c.turn?.disengaged && <span className="muted small">{t('move.disengaged')}</span>}
      {!c.turn?.disengaged && (c.turn?.moved ?? 0) > 0 && reactors.length > 0 && (
        <select
          value=""
          aria-label={t('move.oaPick')}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            act((s, who) => {
              const reactor = s.combatants.find((x) => x.id === id)
              if (reactor) opportunityAttack(s, reactor, who)
            }, t('lbl.move', { name: c.name }))
            onReact(id)
          }}
        >
          <option value="">{t('move.oaPick')}</option>
          {reactors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
    </div>
  )
}
