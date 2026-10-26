import { useSyncExternalStore } from 'react'
import { db } from '../db'
import type { Item } from '../types'
import { api } from './api'
import { t } from './i18n'
import { newId } from './id'
import { receiveItem, withGearAc } from './inventory'

/**
 * Items passed to a character that belongs to another account. A player can only write their own characters, so the giver's browser leaves the item
 * on the server (`GiftController`) and the receiving account's browser collects it with its sync poll: it adds the item to its own character, tells the
 * user, and asks the server to forget it. Characters on the same device are moved directly (`store.transferItem`) and never come through here.
 */
export interface IncomingGift {
  id: number
  /** The receiving character's id in the campaign */
  to: string
  /** The giving character's name */
  from: string
  /** The item as JSON text */
  item: string
}
export interface PartyMember {
  key: string
  name: string
  /** Account name of whoever plays it */
  owner: string | null
}

export const loadParty = (campaignId: number) => api.get<PartyMember[]>(`/campaigns/${campaignId}/party`)
export const sendGift = (campaignId: number, fromKey: string, toKey: string, item: Item) =>
  api.post(`/campaigns/${campaignId}/gifts`, { from: fromKey, to: toKey, item: JSON.stringify(item) })

/** Add each waiting gift to its character, then let the server forget it. A marker per gift makes a repeated poll harmless if the delete fails. */
export async function receiveGifts(gifts: IncomingGift[], campaignId: number) {
  for (const g of gifts) {
    let item: Item
    try {
      item = JSON.parse(g.item) as Item
    } catch {
      continue
    }
    const result = await db.transaction('rw', db.characters, db.kv, async () => {
      const marker = `sync:gift:${g.id}` // local-only key (see isLocalOnly in sync.ts)
      if (await db.kv.get(marker)) return 'seen'
      const c = await db.characters.get(Number(g.to))
      if (!c) return 'missing' // not downloaded yet: the next poll tries again
      await db.characters.put(withGearAc({ ...c, items: receiveItem(c.items ?? [], { ...item, id: newId(), equipped: false, attuned: false }) }))
      await db.kv.put({ key: marker, value: Date.now() })
      return 'applied'
    })
    if (result === 'missing') continue
    if (result === 'applied') addNotice(t('gift.received', { from: g.from || '?', qty: item.qty, name: item.name }))
    try {
      await api.delete(`/campaigns/${campaignId}/gifts/${g.id}`)
    } catch {
      // the marker stops a second copy; the next poll deletes it
    }
  }
}

/* ---------------------------------------------------------------- the notices ("Thorin gave you 2 Potion") */

export interface Notice {
  id: number
  text: string
}
let notices: Notice[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function dismissNotice(id: number) {
  notices = notices.filter((n) => n.id !== id)
  emit()
}
export function addNotice(text: string) {
  const id = nextId++
  notices = [...notices, { id, text }]
  emit()
  setTimeout(() => dismissNotice(id), 9000)
}
export const useNotices = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => notices,
  )
