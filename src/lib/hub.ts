import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { toPublic, toPublicSheet, type PublicCombat, type PublicSheet } from './publicState'
import { setLang, useLang, type Lang } from './i18n'
import { useSpotlight } from './spotlight'

/**
 * Live view over the local network. The DM's browser (the "host") pushes the player-safe state to the relay in
 * server/hubPlugin.ts, which forwards it to every viewer (phones, tablets, a TV) that opened `/#player`.
 * Everything here quietly does nothing when the app isn't served by that relay (a static host, a file).
 */

const wsUrl = (role: 'host' | 'viewer') => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/hub?role=${role}`

/* ---------------------------------------------------------------- host status (shared with the Settings page) */

export interface HubStatus {
  state: 'off' | 'connecting' | 'live'
  viewers: number
  urls: string[]
}
let status: HubStatus = { state: 'off', viewers: 0, urls: [] }
const listeners = new Set<() => void>()
const setStatus = (s: HubStatus) => {
  status = s
  listeners.forEach((l) => l())
}
export const useHubStatus = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )

/* ---------------------------------------------------------------- portraits */

const portraitCache = new Map<string, string>()

/** Shrink a portrait to a small JPEG data URL so it is cheap to send over Wi-Fi. */
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

/** Renders nothing; keeps the relay supplied with the current fight and portraits while the DM app is open. */
export function LiveHost() {
  const combat = useLiveQuery(() => db.combat.get('current'), [])
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  const spotlight = useSpotlight()
  const ws = useRef<WebSocket | null>(null)
  const latest = useRef<{ combat?: string; portraits?: string; spotlight?: string; lang?: string }>({})
  const lang = useLang()

  const push = (type: 'combat' | 'portraits' | 'spotlight' | 'lang', data: unknown) => {
    const payload = JSON.stringify({ type, data })
    latest.current[type] = payload
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(payload)
  }

  useEffect(() => {
    push('combat', toPublic(combat) ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat])

  // everyone sees the DM's language
  useEffect(() => {
    push('lang', lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // the character sheet the DM is showing (null = back to the feed); follows HP changes and edits live
  useEffect(() => {
    if (spotlight === undefined || !characters) return
    const c = spotlight ? characters.find((x) => x.id === spotlight.characterId) : undefined
    const fighter = combat?.started ? combat.combatants.find((x) => x.characterId === c?.id) : undefined
    push('spotlight', c && spotlight ? toPublicSheet(c, fighter, { inventory: spotlight.inventory }) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlight, characters, combat])

  useEffect(() => {
    if (!characters) return
    let off = false
    Promise.all(
      characters.map(async (c) => [c.id!, c.image ? await smallPortrait(c.image, `${c.id}:${c.image.size}`) : undefined] as const),
    ).then((pairs) => {
      if (!off) push('portraits', Object.fromEntries(pairs.filter(([, url]) => url)))
    })
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters])

  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let delay = 1000
    const connect = () => {
      if (closed) return
      setStatus({ ...status, state: 'connecting' })
      let socket: WebSocket
      try {
        socket = new WebSocket(wsUrl('host'))
      } catch {
        return setStatus({ state: 'off', viewers: 0, urls: [] })
      }
      ws.current = socket
      socket.onopen = () => {
        delay = 1000
        setStatus({ ...status, state: 'live' })
        for (const payload of Object.values(latest.current)) if (payload) socket.send(payload)
      }
      socket.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as { type: string; urls?: string[]; viewers?: number }
        if (msg.type === 'info') setStatus({ state: 'live', viewers: msg.viewers ?? 0, urls: msg.urls ?? [] })
      }
      socket.onclose = () => {
        ws.current = null
        setStatus({ state: 'off', viewers: 0, urls: status.urls })
        if (closed) return
        retry = setTimeout(connect, delay)
        delay = Math.min(delay * 2, 15000) // a static host has no relay: back off instead of hammering it
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ws.current?.close()
    }
  }, [])

  return null
}

/* ---------------------------------------------------------------- viewer */

export interface RemoteView {
  combat?: PublicCombat | null
  /** The DM's interface language, once the relay has told us */
  lang?: Lang
  /** The character sheet the DM is showing; null = none, undefined = nothing received yet */
  sheet?: PublicSheet | null
  portraits: Record<number, string>
  /** Connected to the relay */
  connected: boolean
  /** The DM's app is currently feeding the relay */
  hostOnline: boolean
}

/** For the player view: the state pushed by the DM's browser over the relay (if there is one). */
export function useRemoteView(): RemoteView {
  const [view, setView] = useState<RemoteView>({ portraits: {}, connected: false, hostOnline: false })
  useEffect(() => {
    let closed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let delay = 1000
    let socket: WebSocket | undefined
    const connect = () => {
      if (closed) return
      try {
        socket = new WebSocket(wsUrl('viewer'))
      } catch {
        return
      }
      socket.onopen = () => {
        delay = 1000
        setView((v) => ({ ...v, connected: true }))
      }
      socket.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as { type: string; data?: unknown; connected?: boolean }
        if (msg.type === 'combat') setView((v) => ({ ...v, combat: (msg.data as PublicCombat | null) ?? null }))
        else if (msg.type === 'lang') {
          const next = msg.data as Lang
          setLang(next)
          setView((v) => ({ ...v, lang: next }))
        } else if (msg.type === 'spotlight') setView((v) => ({ ...v, sheet: (msg.data as PublicSheet | null) ?? null }))
        else if (msg.type === 'portraits') setView((v) => ({ ...v, portraits: (msg.data as Record<number, string>) ?? {} }))
        else if (msg.type === 'host') setView((v) => ({ ...v, hostOnline: !!msg.connected }))
      }
      socket.onclose = () => {
        setView((v) => ({ ...v, connected: false, hostOnline: false }))
        if (closed) return
        retry = setTimeout(connect, delay)
        delay = Math.min(delay * 2, 15000)
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [])
  return view
}
