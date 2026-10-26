import { t } from '../lib/i18n'
import { consumeRoll, KIND_ICON, natOf, useIncomingRolls } from '../lib/rolls'
import { DieToken } from './DieToken'

/** Everything players have typed on their phones that is still waiting, so nothing gets lost when no panel is open. A new roll lands as a die. */
export function RollsTray({ names }: { names: Map<string, string> }) {
  const rolls = useIncomingRolls()
  if (!rolls.length) return null
  return (
    <div className="rolls-tray" aria-label={t('roll.trayTitle')}>
      <div className="roll-tray-head">
        <strong>📱 {t('roll.trayTitle')}</strong>
        <span className="chip">{rolls.length}</span>
      </div>
      <div className="roll-tray-list">
        {rolls.map((r) => {
          const nat = natOf(r.kind, r.value)
          return (
            <div key={r.id} className={`roll-in ${nat ?? ''}`}>
              <DieToken value={r.value} kind={r.kind} />
              <div className="roll-in-text">
                <strong className="roll-in-name">{names.get(r.character) ?? `#${r.character}`}</strong>
                <span>
                  {KIND_ICON[r.kind]} {t(`roll.kind.${r.kind}`)}
                </span>
                {nat && <em className="roll-in-nat">{t(nat === 'nat20' ? 'roll.nat20' : 'roll.nat1')}</em>}
              </div>
              <button className="chip-x" title={t('roll.dismiss')} aria-label={t('roll.dismiss')} onClick={() => consumeRoll(r.id)}>
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
