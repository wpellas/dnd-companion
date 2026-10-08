import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { possessive, t } from '../lib/i18n'
import { setSpotlightInventory, stopShowing, useSpotlight } from '../lib/spotlight'
import { Rich } from './Rich'

/** Shown on every DM tab while a character sheet is on the players' screens, so it never gets forgotten. */
export function SpotlightBar() {
  const spotlight = useSpotlight()
  const character = useLiveQuery(() => (spotlight ? db.characters.get(spotlight.characterId) : undefined), [spotlight?.characterId])
  if (!spotlight) return null
  return (
    <div className="spotlight-bar" role="status">
      <span>
        <Rich text={t('spot.text')} parts={{ who: <strong>{possessive(character?.name ?? t('spot.fallback'))}</strong> }} />
      </span>
      <label className="check small">
        <input type="checkbox" checked={spotlight.inventory} onChange={(e) => setSpotlightInventory(e.target.checked)} />
        <span>{t('spot.inventory')}</span>
      </label>
      <button className="primary" onClick={() => stopShowing()}>
        {t('spot.back')}
      </button>
    </div>
  )
}
