import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { RollSender } from '../components/RollSender'
import { SpellLibraryStatus } from '../components/SpellLibraryStatus'
import { db } from '../db'
import { t } from '../lib/i18n'
import { chooseCampaign, logout, type CampaignRef } from '../lib/session'
import { PartyPage } from './PartyPage'
import { PlayerView } from './PlayerView'

const KEY = 'dnd-companion:interactive'
const readInteractive = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * What a signed-in player sees. By default it is a pure spectator screen: the live table and nothing to do (a banner says when their character
 * is up). Turning on "Interactive" adds the rest: their own characters, and a buzz on their turn. The DM never waits for anything from here.
 */
export function PlayerHome({ campaign }: { campaign: CampaignRef }) {
  const [interactive, setInteractive] = useState(readInteractive)
  const [mine, setMine] = useState(false)
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const ownIds = useMemo(() => new Set((characters ?? []).map((c) => c.id!)), [characters])
  const showMine = interactive && mine

  const toggle = () => {
    const next = !interactive
    setInteractive(next)
    if (!next) setMine(false)
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      /* private mode: just not remembered */
    }
  }

  return (
    <>
      <div className={`player-bar ${showMine ? 'inline' : ''}`}>
        {interactive && (
          <>
            <button className={mine ? '' : 'selected'} onClick={() => setMine(false)}>
              {t('player.backToTable')}
            </button>
            <button className={mine ? 'selected' : ''} onClick={() => setMine(true)}>
              {t('player.myCharacters')}
            </button>
          </>
        )}
        <button className={interactive ? 'selected' : ''} title={t('player.interactiveTitle')} aria-pressed={interactive} onClick={toggle}>
          {t('player.interactive')}
        </button>
        <button onClick={() => void chooseCampaign(undefined)}>{t('camp.switch')}</button>
        <button onClick={() => void logout()}>{t('camp.logout')}</button>
      </div>
      {showMine ? (
        <>
          <PartyPage />
          {/* downloads the spell, class and item lists the character form and the item picker use */}
          <footer className="attribution">
            <div className="sync-status">
              <SpellLibraryStatus />
            </div>
          </footer>
        </>
      ) : (
        <>
          <PlayerView source={{ campaignId: campaign.id }} mine={ownIds} vibrate={interactive} />
          {interactive && <RollSender campaignId={campaign.id} characters={characters ?? []} />}
        </>
      )}
    </>
  )
}
