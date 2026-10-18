import { t } from '../lib/i18n'
import { consumeRoll, useIncomingRolls } from '../lib/rolls'

/** Everything players have typed on their phones that is still waiting, so nothing gets lost when no panel is open. */
export function RollsTray({ names }: { names: Map<string, string> }) {
  const rolls = useIncomingRolls()
  if (!rolls.length) return null
  return (
    <div className="rolls-tray" aria-label={t('roll.trayTitle')}>
      <strong>📱</strong>
      {rolls.map((r) => (
        <span key={r.id} className="chip">
          {names.get(r.character) ?? `#${r.character}`} · {t(`roll.kind.${r.kind}`)} {r.value}
          <button className="chip-x" title={t('roll.dismiss')} aria-label={t('roll.dismiss')} onClick={() => consumeRoll(r.id)}>
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}
