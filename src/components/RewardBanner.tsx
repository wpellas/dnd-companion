import { useState } from 'react'
import { t } from '../lib/i18n'
import { awardLastFight, clearLastFight, useLastFight, type AwardLine } from '../lib/rewards'
import { Rich } from './Rich'

/** After a fight ends: offer to hand its XP to the party, split evenly. Stays until awarded or dismissed. */
export function RewardBanner() {
  const fight = useLastFight()
  const [done, setDone] = useState<AwardLine[]>()

  if (done) {
    return (
      <div className="prompt-banner reward-banner">
        {t('reward.done', { list: done.map((l) => `${l.name} +${l.xp}${l.levelUp ? ' ⬆' : ''}`).join(', ') })}
        <button onClick={() => setDone(undefined)}>{t('common.ok')}</button>
      </div>
    )
  }
  if (!fight) return null
  const each = Math.floor(fight.xp / Math.max(1, fight.characterIds.length))
  return (
    <div className="prompt-banner reward-banner">
      <span>
        <Rich text={t('reward.worth', { n: fight.defeated.length })} parts={{ xp: <strong>{fight.xp.toLocaleString()} XP</strong> }} />
      </span>
      <button className="primary" onClick={async () => setDone(await awardLastFight())}>
        {fight.characterIds.length > 1 ? t('reward.giveEach', { n: each.toLocaleString() }) : t('reward.giveIt')}
      </button>
      <button onClick={() => clearLastFight()}>{t('common.dismiss')}</button>
    </div>
  )
}
