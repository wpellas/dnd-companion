import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import heroLogo from '../assets/images/logo-360.png'
import navLogo from '../assets/images/logo-128.png'
import { CharacterSheetView } from '../components/CharacterSheetView'
import { Portrait } from '../components/Portrait'
import { useRemoteView } from '../lib/hub'
import { possessive, setLang, t, tCondition } from '../lib/i18n'
import { useStoredLanguage } from '../lib/settings'
import { toPublic, toPublicSheet, type PublicCombat } from '../lib/publicState'
import { useSpotlight } from '../lib/spotlight'

/** How long a new announcement stays on screen. */
const EVENT_MS = 22000
const BANNER_MS = 2600

/** Re-render every second so announcements fade away on their own. */
function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(timer)
  }, [interval])
  return now
}

/**
 * Read-only table display. Monsters show a status instead of exact HP / AC so the DM doesn't leak numbers (the data it
 * receives never contains them). It shows whatever the DM's app is broadcasting over the local network when that is
 * available (phones, a TV), and falls back to the local database (the DM's own second window).
 */
export function PlayerView() {
  const remote = useRemoteView()
  const localState = useLiveQuery(() => db.combat.get('current'), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const now = useNow()
  const spotlight = useSpotlight()

  // the DM's language: from the relay, or (the DM's own second window, no relay) from the saved setting. A phone has neither saved.
  const stored = useStoredLanguage()
  const language = remote.lang ?? stored
  useEffect(() => {
    if (language) setLang(language)
  }, [language])

  const combat: PublicCombat | undefined = remote.combat ?? toPublic(localState)
  const portraitFor = (characterId?: number) => (characterId === undefined ? undefined : remote.portraits[characterId])
  const imageFor = (characterId?: number) => characters?.find((ch) => ch.id === characterId)?.image

  // "Merlin's turn!" banner when the turn moves on
  const active = combat?.started ? combat.combatants[combat.turnIndex] : undefined
  const [banner, setBanner] = useState<{ id: string; name: string; round: number }>()
  const lastTurn = useRef<string | undefined>(undefined)
  const turnKey = active ? `${combat!.round}:${active.id}` : undefined
  useEffect(() => {
    if (!active || !turnKey || lastTurn.current === turnKey) return
    const first = lastTurn.current === undefined
    lastTurn.current = turnKey
    if (first) return // don't flash the banner on page load
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBanner({ id: turnKey, name: active.name, round: combat!.round })
    const timer = setTimeout(() => setBanner((b) => (b?.id === turnKey ? undefined : b)), BANNER_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey])

  // the DM is showing one character's sheet instead of the feed: from the relay, or (the DM's own second window) from the local database
  const localChar = spotlight ? characters?.find((c) => c.id === spotlight.characterId) : undefined
  const localSheet =
    spotlight && localChar
      ? toPublicSheet(localChar, localState?.started ? localState.combatants.find((c) => c.characterId === localChar.id) : undefined, { inventory: spotlight.inventory })
      : null
  const sheet = remote.sheet !== undefined ? remote.sheet : localSheet
  const showingSheet = !!sheet

  // keep the creature whose turn it is on screen: a long list would otherwise leave them below the fold
  useEffect(() => {
    if (!turnKey) return
    const frame = requestAnimationFrame(() => document.querySelector('.player-row.active')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [turnKey, showingSheet])
  if (sheet) return <CharacterSheetView sheet={sheet} src={portraitFor(sheet.id)} image={imageFor(sheet.id)} />

  if (!combat || combat.combatants.length === 0) {
    return (
      <div className="player empty">
        <img src={heroLogo} alt={t('player.logoAlt')} />
        <span>{t('player.gather')}</span>
        {remote.connected && !remote.hostOnline && <small className="player-note">{t('player.waitingDm')}</small>}
      </div>
    )
  }

  const recent = combat.events.filter((e) => now - e.at < EVENT_MS).slice(-4)

  return (
    <div className="player">
      <header>
        <img src={navLogo} alt="" />
        {combat.started ? t('player.round', { n: combat.round }) : t('player.rolling')}
        {remote.connected && !remote.hostOnline && <span className="player-note">{t('player.dmOffline')}</span>}
      </header>

      {banner && (
        <div className="turn-banner" key={banner.id} role="status">
          <span>{t('player.turn', { who: possessive(banner.name) })}</span>
        </div>
      )}

      <div className="player-list">
        {combat.combatants.map((c, i) => {
          const isActive = combat.started && i === combat.turnIndex
          const down = c.kind !== 'lair' && c.hp === 0 || (c.kind === 'monster' && c.status === 'Defeated')
          const pct = c.maxHp ? Math.round(((c.hp ?? 0) / c.maxHp) * 100) : 0
          return (
            <div key={c.id} className={`player-row ${c.kind} ${isActive ? 'active' : ''} ${down ? 'down' : ''}`}>
              {/* The portrait sits outside the info bar, overlapping its left edge like a medallion. */}
              {c.kind === 'lair' ? (
                <div className="portrait placeholder" style={{ width: 140, height: 140, fontSize: 64 }}>☗</div>
              ) : (
                <Portrait name={c.name} src={portraitFor(c.characterId)} image={imageFor(c.characterId)} size={140} />
              )}
              <div className="player-card">
                <span className="init-badge">{c.initiative ?? '–'}</span>
                <div className="grow">
                  <div className="player-name">{c.kind === 'lair' ? t('player.lair') : c.name}</div>
                  {c.kind === 'pc' && (
                    <>
                      <div className="bar big">
                        <div className="fill" style={{ width: `${pct}%` }} data-low={pct <= 50} />
                      </div>
                      <div className="hp-text">
                        {c.hp} / {c.maxHp} HP
                        {(c.tempHp ?? 0) > 0 && <em> +{c.tempHp}</em>}
                      </div>
                      {c.deathSaves && (
                        <div className="death-saves">
                          {t('player.deathSaves')} <span className="ok">{'✓'.repeat(c.deathSaves.successes) || '·'}</span> <span className="bad">{'✗'.repeat(c.deathSaves.failures) || '·'}</span>
                        </div>
                      )}
                    </>
                  )}
                  {c.kind === 'monster' && <div className={`status ${c.status.toLowerCase()}`}>{t(`status.${c.status}`)}</div>}
                  {(c.conditions.length > 0 || c.concentrating) && (
                    <div className="badges">
                      {c.concentrating && <span className="badge">{t('player.concentrating')}</span>}
                      {c.conditions.map((cond) => (
                        <span className="badge" key={cond}>
                          {cond === 'Exhaustion' && c.exhaustion ? `${tCondition('Exhaustion')} ${c.exhaustion}` : tCondition(cond)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {recent.length > 0 && (
        <div className="event-strip" aria-live="polite">
          {recent.map((e, i) => (
            <div key={e.id} className="event" style={{ opacity: 0.45 + (0.55 * (i + 1)) / recent.length }}>
              {e.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
