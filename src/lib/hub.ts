import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { api } from './api'
import { pictureFor, useAvatars } from './avatars'
import { toPublic, toPublicSheet, type PublicCombat, type PublicSheet } from './publicState'
import { setLang, useLang, type Lang } from './i18n'
import { useSession } from './session'
import { useSpotlight } from './spotlight'
import { useMapShown, type PublicMap } from './maps'
import { useTableMap, type PublicFog } from './fog'

/**
 * The live view. The DM's browser (`LiveHost`) uploads the player-safe parts of the fight to the server; players (signed in) and the table's
 * TV (secret link) poll them with `useRemoteView`. `publicState.ts` strips monster HP / AC / the DM log before anything is uploaded, so the
 * server never holds them.
 */

/* ---------------------------------------------------------------- portraits */

const portraitCache = new Map<string, string>()

/** Shrink a portrait to a small JPEG data URL so it is cheap to send. */
async function smallPortrait(blob: Blob, key: string): Promise<string | undefined> {
  const hit = portraitCache.get(key)
  if (hit) return hit
  try {
    const bmp = await createImageBitmap(blob)
    const size = 200
    const scale = Math.max(size / bmp.width, size / bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const g = canvas.getContext('2d')!
    g.drawImage(bmp, (size - bmp.width * scale) / 2, (size - bmp.height * scale) / 2, bmp.width * scale, bmp.height * scale)
    const url = canvas.toDataURL('image/jpeg', 0.8)
    portraitCache.set(key, url)
    return url
  } catch {
    return undefined
  }
}

/* ---------------------------------------------------------------- host */

type Part = 'combat' | 'portraits' | 'sheet' | 'map' | 'fog' | 'lang' | 'ping'
const PUSH_MS = 300
const HEARTBEAT_MS = 20000

/** Renders nothing; keeps the server supplied with the current fight, portraits, shown sheet and language while the DM app is open. */
export function LiveHost() {
  const { campaign } = useSession()
  const combat = useLiveQuery(() => db.combat.get('current'), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const spotlight = useSpotlight()
  const mapShown = useMapShown()
  const maps = useLiveQuery(() => db.maps.toArray(), [])
  const lang = useLang()
  const avatars = useAvatars()
  // which enemy in this fight has which picture (a stable string, so the effect below does not re-run on every HP change)
  const monsterKeys = JSON.stringify((combat?.combatants ?? []).filter((c) => c.kind === 'monster').map((c) => [c.id, pictureFor(c, combat?.combatants ?? [], avatars)?.key]))
  const campaignId = campaign?.id
  const wanted = useRef(new Map<Part, string>()) // what the table should see
  const sent = useRef(new Map<Part, string>()) // what the server has
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  /** Upload the parts that differ. A failed upload is simply tried again on the next change or heartbeat. */
  const flush = async () => {
    if (campaignId === undefined) return
    const parts: Record<string, string> = {}
    for (const [part, json] of wanted.current) if (sent.current.get(part) !== json) parts[part] = json
    if (!Object.keys(parts).length) return
    try {
      await api.post(`/campaigns/${campaignId}/live`, { parts })
      for (const [part, json] of Object.entries(parts)) sent.current.set(part as Part, json)
    } catch {
      /* offline */
    }
  }
  const want = (part: Part, data: unknown) => {
    wanted.current.set(part, JSON.stringify(data ?? null))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), PUSH_MS)
  }

  // the map the DM is showing (null = none), sent as a finished picture so what is hidden on it can never reach the table; with it the fog masks and which tokens
  // the players may see (no token goes out until that is known). This device also records what the party explores.
  const shownMap = mapShown === undefined || !maps ? undefined : ((mapShown && maps.find((x) => x.id === mapShown.mapId)) ?? null)
  const table = useTableMap(shownMap, combat?.combatants, { write: true })
  useEffect(() => {
    want('combat', toPublic(combat, table.cover))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat, table.cover, campaignId])
  useEffect(() => {
    if (table.view !== undefined) want('map', table.view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.view, campaignId])
  useEffect(() => {
    want('fog', table.fog ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.fog, campaignId])

  // everyone sees the DM's language
  useEffect(() => {
    want('lang', lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, campaignId])

  // the character sheet the DM is showing (null = back to the feed); follows HP changes and edits live
  useEffect(() => {
    if (spotlight === undefined || !characters) return
    const c = spotlight ? characters.find((x) => x.id === spotlight.characterId) : undefined
    const fighter = combat?.started ? combat.combatants.find((x) => x.characterId === c?.id) : undefined
    want('sheet', c && spotlight ? toPublicSheet(c, fighter, { inventory: spotlight.inventory }) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlight, characters, combat, campaignId])


  useEffect(() => {
    if (!characters) return
    let off = false
    const people = characters.map(async (c) => [String(c.id), c.image ? await smallPortrait(c.image, `${c.id}:${c.image.size}`) : undefined] as const)
    const enemies = (JSON.parse(monsterKeys) as [string, string | undefined][]).map(async ([id, key]) => {
      const blob = key ? avatars.get(key) : undefined
      return [id, blob ? await smallPortrait(blob, `avatar:${key}:${blob.size}`) : undefined] as const
    })
    Promise.all([...people, ...enemies]).then((pairs) => {
      if (!off) want('portraits', Object.fromEntries(pairs.filter(([, url]) => url)))
    })
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters, campaignId, avatars, monsterKeys])

  // "the DM's app is open" for the viewers, and the retry for uploads that failed
  useEffect(() => {
    const beat = setInterval(() => {
      wanted.current.set('ping', String(Date.now()))
      void flush()
    }, HEARTBEAT_MS)
    wanted.current.set('ping', String(Date.now()))
    return () => clearInterval(beat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  return null
}

/* ---------------------------------------------------------------- viewer */

/** Where a viewer reads from: a signed-in member of the campaign, or the table screen's secret link. */
export type LiveSource = { campaignId: number } | { token: string }

export interface RemoteView {
  combat?: PublicCombat | null
  /** The DM's interface language, once it has arrived */
  lang?: Lang
  /** The character sheet the DM is showing; null = none, undefined = nothing received yet */
  sheet?: PublicSheet | null
  /** The map the DM is showing; null = none, undefined = nothing received yet */
  map?: PublicMap | null
  /** The fog-of-war masks for that map (null = none) */
  fog?: PublicFog | null
  /** Data URLs by character id, or by combatant id for enemies */
  portraits: Record<string, string>
  /** The last poll worked */
  connected: boolean
  /** The DM's app is open right now */
  hostOnline: boolean
  /** The secret link has been replaced */
  gone: boolean
}

const POLL_MS = 1500
const POLL_HIDDEN_MS = 8000

/** For the player view: the state uploaded by the DM's browser, polled every second or two. Without a source it does nothing (the DM's own second window reads its database). */
export function useRemoteView(source?: LiveSource): RemoteView {
  const [view, setView] = useState<RemoteView>({ portraits: {}, connected: false, hostOnline: false, gone: false })
  const key = !source ? '' : 'token' in source ? `t:${source.token}` : `c:${source.campaignId}`
  useEffect(() => {
    if (!source) return
    let off = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const versions: Record<string, number> = {}
    const base = 'token' in source ? `/table/${encodeURIComponent(source.token)}/live` : `/campaigns/${source.campaignId}/live`

    const poll = async () => {
      try {
        const query = Object.entries(versions).map(([part, version]) => `${part}=${version}`).join('&')
        const res = await api.get<{ parts: Record<string, { version: number; data: string | null }>; host_online: boolean }>(query ? `${base}?${query}` : base)
        if (off) return
        const patch: Partial<RemoteView> = {}
        for (const [part, { version, data }] of Object.entries(res.parts)) {
          versions[part] = version
          const value = data === null ? null : JSON.parse(data)
          if (part === 'combat') patch.combat = value as PublicCombat | null
          else if (part === 'sheet') patch.sheet = value as PublicSheet | null
          else if (part === 'map') patch.map = value as PublicMap | null
          else if (part === 'fog') patch.fog = value as PublicFog | null
          else if (part === 'portraits') patch.portraits = (value as Record<string, string> | null) ?? {}
          else if (part === 'lang' && value) {
            setLang(value as Lang)
            patch.lang = value as Lang
          }
        }
        setView((v) => ({ ...v, ...patch, connected: true, hostOnline: res.host_online, gone: false }))
      } catch (e) {
        if (!off) setView((v) => ({ ...v, connected: false, hostOnline: false, gone: (e as { status?: number }).status === 404 }))
      }
      if (!off) timer = setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_MS)
    }
    void poll()
    return () => {
      off = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return view
}
