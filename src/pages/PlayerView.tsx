import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import heroLogo from '../assets/images/logo-360.png'
import navLogo from '../assets/images/logo-128.png'
import { CharacterSheetView } from '../components/CharacterSheetView'
import { Portrait } from '../components/Portrait'
import { publicMap, useMapShown, type PublicMap } from '../lib/maps'
import { explainCondition, explainEffect, GLOSSARY } from '../lib/explain'
import { conditionTone, type Tone } from '../lib/tones'
import { pictureFor } from '../lib/avatars'
import { useRemoteView, type LiveSource } from '../lib/hub'
import { possessive, setLang, t, tCondition } from '../lib/i18n'
import { useStoredLanguage } from '../lib/settings'
import { toPublic, toPublicSheet, type PublicCombat } from '../lib/publicState'
import type { PublicEvent } from '../types'
import { useSpotlight } from '../lib/spotlight'

/** How long a new announcement stays on screen. */
const EVENT_MS = 22000
const BANNER_MS = 2600
const FX_MS = 2600

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
 * receives never contains them). With a `source` (a signed-in player, or the TV's secret link) it shows what the DM's app
 * uploads to the server; without one it reads the local database (the DM's own second window).
 */
export function PlayerView({ source, mine, vibrate }: { source?: LiveSource; mine?: ReadonlySet<number>; vibrate?: boolean }) {
  const remote = useRemoteView(source)
  const localState = useLiveQuery(() => db.combat.get('current'), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const now = useNow()
  const spotlight = useSpotlight()

  // the DM's language: from the live view, or (the DM's own second window, no live view) from the saved setting. A phone has neither saved.
  const stored = useStoredLanguage()
  const language = remote.lang ?? stored
  useEffect(() => {
    if (language) setLang(language)
  }, [language])

  const combat: PublicCombat | undefined = remote.combat ?? toPublic(localState)
  const portraitFor = (characterId?: number) => (characterId === undefined ? undefined : remote.portraits[characterId])
  // the DM's own second window has no live view: enemies' pictures come from the local database, by combatant
  const localAvatars = useLiveQuery(async () => {
    const fight = await db.combat.get('current')
    const byKey = new Map((await db.avatars.toArray()).map((a) => [a.key, a.image]))
    const all = fight?.combatants ?? []
    return new Map(all.flatMap((c) => { const p = c.kind === 'monster' ? pictureFor(c, all, byKey) : undefined; return p ? [[c.id, p.blob] as const] : [] }))
  }, [])
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

  // hits, misses, damage and healing: each new announcement that carries an effect plays once, one after another (not for what was already there on load)
  const seenEvents = useRef<Set<string> | undefined>(undefined)
  const [fxQueue, setFxQueue] = useState<PublicEvent[]>([])
  const [fx, setFx] = useState<PublicEvent>()
  const events = combat?.events
  useEffect(() => {
    if (!events) return
    if (!seenEvents.current) {
      seenEvents.current = new Set(events.map((e) => e.id))
      return
    }
    const fresh = events.filter((e) => !seenEvents.current!.has(e.id))
    fresh.forEach((e) => seenEvents.current!.add(e.id))
    const playable = fresh.filter((e) => e.fx && Date.now() - e.at < 10000)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (playable.length) setFxQueue((q) => [...q, ...playable].slice(-6))
  }, [events])
  useEffect(() => {
    if (fx || fxQueue.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFx(fxQueue[0])
    setFxQueue(fxQueue.slice(1))
  }, [fx, fxQueue])
  useEffect(() => {
    if (!fx) return
    const timer = setTimeout(() => setFx(undefined), FX_MS)
    return () => clearTimeout(timer)
  }, [fx])

  // a signed-in player is told when their character is up (or next): quietly, on screen; the buzz is only for those who switched interaction on
  const isMine = (c?: { characterId?: number }) => c?.characterId !== undefined && !!mine?.has(c.characterId)
  const yourTurn = isMine(active)
  const upNext = (() => {
    if (!combat?.started || yourTurn) return undefined
    const n = combat.combatants.length
    for (let i = 1; i < n; i++) {
      const c = combat.combatants[(combat.turnIndex + i) % n]
      if (c.kind === 'lair' || (c.kind === 'monster' && c.status === 'Defeated')) continue
      return isMine(c) ? c : undefined
    }
    return undefined
  })()
  useEffect(() => {
    if (vibrate && yourTurn) navigator.vibrate?.([250, 120, 250])
  }, [turnKey, vibrate, yourTurn])

  // the DM is showing one character's sheet instead of the feed: from the live view, or (the DM's own second window) from the local database
  const localChar = spotlight ? characters?.find((c) => c.id === spotlight.characterId) : undefined
  const localSheet =
    spotlight && localChar
      ? toPublicSheet(localChar, localState?.started ? localState.combatants.find((c) => c.characterId === localChar.id) : undefined, { inventory: spotlight.inventory })
      : null
  const sheet = remote.sheet !== undefined ? remote.sheet : localSheet
  // a map being shown: from the live view, or (the DM's own second window) from the local database
  const localMapShown = useMapShown()
  const localMap = useLiveQuery(async (): Promise<PublicMap | null> => {
    const m = localMapShown ? await db.maps.get(localMapShown.mapId) : undefined
    return m ? publicMap(m) : null // composed like the upload, so this window never shows a layer that is switched off
  }, [localMapShown?.mapId])
  const map = remote.map !== undefined ? remote.map : localMap
  const showingSheet = !!sheet

  // tap a badge for what it means, and a "?" for the terms; both are optional help, nothing here asks anything of a spectator
  const [explain, setExplain] = useState<{ row: string; text: string }>()
  const [glossary, setGlossary] = useState(false)
  const badge = (row: string, key: string, text: () => string, label: React.ReactNode, tone?: Tone) => (
    <button className="badge" data-tone={tone} key={key} aria-expanded={explain?.row === row && explain.text === text()} onClick={() => setExplain(explain?.row === row && explain.text === text() ? undefined : { row, text: text() })}>
      {label}
    </button>
  )

  // keep the creature whose turn it is on screen: a long list would otherwise leave them below the fold
  useEffect(() => {
    if (!turnKey) return
    const frame = requestAnimationFrame(() => document.querySelector('.player-row.active')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [turnKey, showingSheet])
  if (remote.gone) {
    return (
      <div className="player empty">
        <img src={heroLogo} alt={t('player.logoAlt')} />
        <span>{t('player.linkGone')}</span>
      </div>
    )
  }
  if (map) {
    return (
      <div className="player map-view">
        <img src={map.imageData} alt={map.name} />
      </div>
    )
  }
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
        <button className="glossary-btn" title={t('gloss.title')} aria-label={t('gloss.title')} aria-expanded={glossary} onClick={() => setGlossary(!glossary)}>
          ?
        </button>
      </header>

      {glossary && (
        <dl className="glossary">
          {GLOSSARY.map((k) => (
            <div key={k}>
              <dt>{t(`gloss.${k}`)}</dt>
              <dd>{t(`gloss.${k}.text`)}</dd>
            </div>
          ))}
        </dl>
      )}

      {yourTurn && (
        <div className="your-turn" role="status">
          {t('player.yourTurn')}
        </div>
      )}
      {upNext && (
        <div className="up-next" role="status">
          {t('player.upNext')}
        </div>
      )}

      {banner && (
        <div className="turn-banner" key={banner.id} role="status">
          <span>{t('player.turn', { who: possessive(banner.name) })}</span>
        </div>
      )}

      {fx?.fx && !banner && (
        <div className={`fx-banner ${fx.fx.kind}`} key={fx.id} role="presentation" aria-hidden="true">
          <span>
            {fx.fx.amount !== undefined && fx.fx.kind !== 'miss' ? `${fx.fx.kind === 'heal' ? '+' : '−'}${fx.fx.amount}` : t(`fx.${fx.fx.kind}`)}
          </span>
          <small>{combat.combatants.find((c) => c.id === fx.fx!.targetId)?.name}</small>
        </div>
      )}

      <div className="player-list">
        {combat.combatants.map((c, i) => {
          const isActive = combat.started && i === combat.turnIndex
          const down = c.kind !== 'lair' && c.hp === 0 || (c.kind === 'monster' && c.status === 'Defeated')
          const pct = c.maxHp ? Math.round(((c.hp ?? 0) / c.maxHp) * 100) : 0
          return (
            <div key={c.id} className={`player-row ${c.kind} ${c.ally ? 'ally' : ''} ${isActive ? 'active' : ''} ${down ? 'down' : ''} ${fx?.fx?.targetId === c.id ? `fx-${fx.fx.kind}` : ''}`} data-fx={fx?.fx?.targetId === c.id ? fx.id : undefined}>
              {/* The portrait sits outside the info bar, overlapping its left edge like a medallion. */}
              {c.kind === 'lair' ? (
                <div className="portrait placeholder" style={{ width: 140, height: 140, fontSize: 64 }}>☗</div>
              ) : (
                <Portrait name={c.name} src={c.characterId !== undefined ? portraitFor(c.characterId) : remote.portraits[c.id]} image={c.characterId !== undefined ? imageFor(c.characterId) : localAvatars?.get(c.id)} size={140} />
              )}
              <div className="player-card">
                <span className="init-badge">{c.initiative ?? '–'}</span>
                <div className="grow">
                  <div className="player-name">{c.kind === 'lair' ? t('player.lair') : c.name}</div>
                  {c.hp !== undefined && (
                    <>
                      <div className="bar big">
                        <div className="fill" style={{ width: `${pct}%` }} data-low={pct <= 50} />
                        <div className="hp-text">
                          {c.hp} / {c.maxHp} HP
                          {(c.tempHp ?? 0) > 0 && <em> +{c.tempHp}</em>}
                        </div>
                      </div>
                      {c.deathSaves && (
                        <div className="death-saves">
                          {t('player.deathSaves')} <span className="ok">{'✓'.repeat(c.deathSaves.successes) || '·'}</span> <span className="bad">{'✗'.repeat(c.deathSaves.failures) || '·'}</span>
                        </div>
                      )}
                    </>
                  )}
                  {c.kind === 'monster' && !c.ally && <div className={`status ${c.status.toLowerCase()}`}>{t(`status.${c.status}`)}</div>}
                  {(c.conditions.length > 0 || c.concentrating || c.inspired || !!c.form || !!c.effects?.length) && (
                    <div className="badges">
                      {c.form && badge(c.id, 'form', () => t('gloss.form', { form: c.form! }), <>🐾 {c.form}</>)}
                      {c.inspired && badge(c.id, 'insp', () => t('gloss.inspiration.text'), <>★ {t('insp.button')}</>)}
                      {c.concentrating && badge(c.id, 'conc', () => t('gloss.concentration.text'), t('player.concentrating'))}
                      {c.effects?.map((e) => badge(c.id, `e-${e.name}`, () => explainEffect(e.name), <>✦ {e.name}{e.rounds !== undefined && ` · ${e.rounds}`}</>))}
                      {c.conditions.map((cond) => badge(c.id, cond, () => explainCondition(cond), cond === 'Exhaustion' && c.exhaustion ? `${tCondition('Exhaustion')} ${c.exhaustion}` : tCondition(cond), conditionTone(cond)))}
                    </div>
                  )}
                  {explain?.row === c.id && <div className="explain" role="note">{explain.text}</div>}
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
