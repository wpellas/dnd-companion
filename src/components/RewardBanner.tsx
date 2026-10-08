import { useState } from 'react'
import { awardLastFight, clearLastFight, useLastFight, type AwardLine } from '../lib/rewards'

/** After a fight ends: offer to hand its XP to the party, split evenly. Stays until awarded or dismissed. */
export function RewardBanner() {
  const fight = useLastFight()
  const [done, setDone] = useState<AwardLine[]>()

  if (done) {
    return (
      <div className="prompt-banner reward-banner">
        Awarded XP: {done.map((l) => `${l.name} +${l.xp}${l.levelUp ? ' ⬆' : ''}`).join(', ')}
        <button onClick={() => setDone(undefined)}>OK</button>
      </div>
    )
  }
  if (!fight) return null
  const each = Math.floor(fight.xp / Math.max(1, fight.characterIds.length))
  return (
    <div className="prompt-banner reward-banner">
      <span>
        The fight was worth <strong>{fight.xp.toLocaleString()} XP</strong> ({fight.defeated.length} defeated)
      </span>
      <button className="primary" onClick={async () => setDone(await awardLastFight())}>
        Give {fight.characterIds.length > 1 ? `${each.toLocaleString()} each` : 'it'} to the party
      </button>
      <button onClick={() => clearLastFight()}>Dismiss</button>
    </div>
  )
}
