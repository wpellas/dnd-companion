import type { Table } from 'dexie'
import { useSyncExternalStore } from 'react'
import type { AppDB } from '../db'
import { api, ApiError } from './api'
import { receiveGifts, type IncomingGift } from './gifts'
import { setIncomingRolls, type IncomingRoll } from './rolls'

/**
 * Keeps a campaign's local database (a mirror) in step with the server, so the rest of the app can keep reading and writing Dexie as before.
 *
 * - Every local write marks its record "dirty" (Dexie hooks). A short while later the dirty records are pushed as JSON; a record that already
 *   equals what the server has is skipped, which also makes the echo of our own pushes harmless.
 * - Every couple of seconds we ask the server for what changed after our revision (`cursor`) and apply it, except records with local
 *   changes still waiting to be sent (ours win until they are sent). Push and pull run one after the other, never together.
 * - Offline is fine: the dirty set and the cursor live in the local database, so changes wait and go out when the server is back.
 * - Last write wins per record. The server never looks inside the data (see SyncController).
 */

export const COLLECTIONS = ['characters', 'monsters', 'combat', 'encounters', 'journal', 'kv', 'avatars', 'maps'] as const
export type Collection = (typeof COLLECTIONS)[number]

/** Collections whose primary key is a number (auto-increment); the others use strings. */
const NUMERIC = new Set<Collection>(['characters', 'monsters', 'encounters', 'journal', 'maps'])
/** Bookkeeping that belongs to this browser only: the SRD library cache, the last-backup reminder and this engine's own state. */
const isLocalOnly = (collection: Collection, key: string) => collection === 'kv' && (key.startsWith('sync:') || key.startsWith('api:') || key === 'lastBackup')

const STATE_KEY = 'sync:state'
const PRIMED_KEY = 'sync:primed'
const POLL_MS = 2500
const POLL_HIDDEN_MS = 12000
const CHUNK_DOCS = 40
const CHUNK_BYTES = 1_500_000

/* ---------------------------------------------------------------- status (for the UI) */

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline'
  /** Local changes not on the server yet */
  pending: number
  /** The first pull has finished (or this device already has the campaign): the campaign can be shown */
  ready: boolean
}
let status: SyncStatus = { state: 'syncing', pending: 0, ready: false }
const listeners = new Set<() => void>()
const setStatus = (next: SyncStatus) => {
  if (next.state === status.state && next.pending === status.pending && next.ready === status.ready) return
  status = next
  listeners.forEach((l) => l())
}
export const useSyncStatus = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )

/* ---------------------------------------------------------------- portraits travel inside the character record as a small data URL */

const portraits = new WeakMap<Blob, string>()
import { blobToDataUrl } from './image'

async function shrink(blob: Blob): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, 360 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return undefined
  }
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',')
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: head.match(/:(.*?);/)?.[1] ?? 'image/jpeg' })
}

/** The JSON the server stores for a local record. The portrait Blob becomes `imageData`; the Blob we later build from it remembers that string, so a pulled record compares equal. */
async function toServer(collection: Collection, row: object): Promise<string> {
  if (collection === 'combat') {
    // The undo stack is 25 full snapshots: 5x the rest of the fight, re-sent on every click. It stays on the device that made the changes
    // (undo on another device would revert its own work anyway); a fight applied from the server simply starts with an empty stack.
    const { history, ...rest } = row as { history?: unknown }
    void history
    return JSON.stringify(rest)
  }
  if (collection !== 'characters' && collection !== 'avatars' && collection !== 'maps') return JSON.stringify(row)
  const { image, ownerId, ...rest } = row as { image?: Blob; ownerId?: number }
  void ownerId // the owner is the server's column, not part of the record
  if (!image) return JSON.stringify(rest)
  let imageData = portraits.get(image)
  if (!imageData) {
    imageData = collection === 'maps' ? await blobToDataUrl(image) : await shrink(image) // a map was already shrunk when it was added: keep its size
    if (imageData) portraits.set(image, imageData)
  }
  return JSON.stringify(imageData ? { ...rest, imageData } : rest)
}

function fromServer(collection: Collection, json: string): object {
  const row = JSON.parse(json)
  if ((collection === 'characters' || collection === 'avatars' || collection === 'maps') && typeof row.imageData === 'string') {
    const image = dataUrlToBlob(row.imageData)
    portraits.set(image, row.imageData)
    delete row.imageData
    row.image = image
  }
  return row
}

/* ---------------------------------------------------------------- the engine */

const idOf = (collection: Collection, key: unknown) => `${collection}|${String(key)}`
const splitId = (id: string) => [id.slice(0, id.indexOf('|')) as Collection, id.slice(id.indexOf('|') + 1)] as const

/** What identifies a version of a record: its JSON, and for characters also who owns it (handing a character over changes nothing else). null = deleted. */
const sigOf = (collection: Collection, data: string | null, owner?: number | null) => (data === null ? null : collection === 'characters' ? `${data}|${owner ?? ''}` : data)

interface Job {
  id: string
  collection: Collection
  key: string
  data: string | null
  owner?: number
  sig: string | null
  seq: number
}

class Engine {
  private dirty = new Map<string, number>() // record -> how many local writes it has had (a change during a push stays dirty)
  /** What the server has for a record (null = deleted), as far as we know. */
  private sent = new Map<string, string | null>()
  private cursor = 0
  private seq = 0
  private needFull = false
  private stopped = false
  private ready = false
  private chain: Promise<void> = Promise.resolve()
  private timer?: ReturnType<typeof setTimeout>
  private flushTimer?: ReturnType<typeof setTimeout>
  private persisted = ''
  private unhook: (() => void)[] = []

  private db: AppDB
  private campaignId: number
  private userId: number
  private onLost: (why: 'login' | 'campaign') => void

  constructor(db: AppDB, campaignId: number, userId: number, onLost: (why: 'login' | 'campaign') => void) {
    this.db = db
    this.campaignId = campaignId
    this.userId = userId
    this.onLost = onLost
  }

  private table(collection: Collection) {
    return this.db[collection] as unknown as Table<object, unknown>
  }

  async start() {
    await this.prime()
    const saved = (await this.db.kv.get(STATE_KEY))?.value as { cursor?: number; dirty?: string[] } | undefined
    this.cursor = saved?.cursor ?? 0
    this.ready = this.cursor > 0
    saved?.dirty?.forEach((id) => this.dirty.set(id, ++this.seq))
    this.hook()
    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('online', this.onOnline)
    setStatus({ state: 'syncing', pending: this.dirty.size, ready: this.ready })
    await this.tick()
    this.loop()
  }

  async stop() {
    this.stopped = true
    clearTimeout(this.timer)
    clearTimeout(this.flushTimer)
    this.unhook.forEach((f) => f())
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('online', this.onOnline)
    await this.chain
    await this.persist()
    setIncomingRolls([])
  }

  /** New ids are made in the browser, so each user gets their own number range and two people can never pick the same one. */
  private async prime() {
    if (await this.db.kv.get(PRIMED_KEY)) return
    const base = this.userId * 1_000_000_000
    for (const c of ['characters', 'monsters', 'encounters', 'journal'] as const) {
      const table = this.table(c)
      await table.put({ id: base })
      await table.delete(base)
    }
    await this.db.kv.put({ key: PRIMED_KEY, value: true })
  }

  private hook() {
    for (const collection of COLLECTIONS) {
      const table = this.table(collection)
      const mark = (key: unknown) => this.mark(collection, key)
      const onCreate = function (this: { onsuccess?: (key: unknown) => void }, primKey: unknown) {
        if (primKey !== undefined) mark(primKey)
        else this.onsuccess = mark // auto-increment: the key exists only afterwards
      }
      const onUpdate = (_changes: unknown, primKey: unknown) => {
        mark(primKey)
      }
      const onDelete = (primKey: unknown) => {
        mark(primKey)
      }
      table.hook('creating', onCreate as never)
      table.hook('updating', onUpdate as never)
      table.hook('deleting', onDelete as never)
      this.unhook.push(() => {
        table.hook('creating').unsubscribe(onCreate as never)
        table.hook('updating').unsubscribe(onUpdate as never)
        table.hook('deleting').unsubscribe(onDelete as never)
      })
    }
  }

  private mark(collection: Collection, key: unknown) {
    if (this.stopped || isLocalOnly(collection, String(key))) return
    this.dirty.set(idOf(collection, key), ++this.seq)
    clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => void this.tick(), 400)
  }

  private onVisible = () => {
    if (!document.hidden) void this.tick()
  }
  private onOnline = () => void this.tick()

  private loop() {
    this.timer = setTimeout(async () => {
      await this.tick()
      if (!this.stopped) this.loop()
    }, document.hidden ? POLL_HIDDEN_MS : POLL_MS)
  }

  /** One round: send our changes, then fetch theirs. Rounds are queued so they never overlap. */
  tick(): Promise<void> {
    this.chain = this.chain.then(() => this.cycle())
    return this.chain
  }

  private async cycle() {
    if (this.stopped) return
    try {
      if (this.dirty.size) setStatus({ state: 'syncing', pending: this.dirty.size, ready: this.ready })
      await this.flush()
      await this.pull()
      this.ready = true
      await this.persist()
      setStatus({ state: 'idle', pending: this.dirty.size, ready: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.onLost('login')
      else if (e instanceof ApiError && e.status === 404) this.onLost('campaign')
      else setStatus({ state: 'offline', pending: this.dirty.size, ready: this.ready })
    }
  }

  private clearIfUnchanged(id: string, seq: number) {
    if (this.dirty.get(id) === seq) this.dirty.delete(id)
  }

  private async flush() {
    const jobs: Job[] = []
    for (const [id, seq] of [...this.dirty]) {
      const [collection, key] = splitId(id)
      const row = await this.table(collection).get(NUMERIC.has(collection) ? Number(key) : key)
      const data = row === undefined ? null : await toServer(collection, row)
      const owner = collection === 'characters' ? (row as { ownerId?: number } | undefined)?.ownerId : undefined
      const sig = sigOf(collection, data, owner)
      if (this.sent.has(id) && this.sent.get(id) === sig) this.clearIfUnchanged(id, seq)
      else jobs.push({ id, collection, key, data, owner, sig, seq })
    }
    let chunk: Job[] = []
    let bytes = 0
    const send = async () => {
      if (!chunk.length) return
      const res = await api.post<{ rejected: { collection: Collection; key: string }[] }>(`/campaigns/${this.campaignId}/sync`, {
        docs: chunk.map(({ collection, key, data, owner }) => ({ collection, key, data, ...(owner === undefined ? {} : { owner_id: owner }) })),
      })
      const refused = new Set(res.rejected.map((r) => idOf(r.collection, r.key)))
      for (const job of chunk) {
        if (refused.has(job.id)) {
          this.needFull = true // the server keeps its version: fetch it again
          this.sent.delete(job.id)
        } else this.sent.set(job.id, job.sig)
        this.clearIfUnchanged(job.id, job.seq)
      }
      chunk = []
      bytes = 0
    }
    for (const job of jobs) {
      if (chunk.length >= CHUNK_DOCS || bytes + (job.data?.length ?? 0) > CHUNK_BYTES) await send()
      chunk.push(job)
      bytes += job.data?.length ?? 0
    }
    await send()
  }

  private async pull() {
    const res = await api.get<{ rev: number; owned?: string[]; rolls?: IncomingRoll[] | null; gifts?: IncomingGift[]; docs: { collection: Collection; key: string; data: string | null; deleted: boolean; owner_id: number | null }[] }>(
      `/campaigns/${this.campaignId}/sync?since=${this.needFull ? 0 : this.cursor}`,
    )
    const put = new Map<Collection, object[]>()
    const del = new Map<Collection, unknown[]>()
    const touched = new Set<Collection>()
    for (const d of res.docs) {
      const id = idOf(d.collection, d.key)
      if (this.dirty.has(id)) continue // our newer change goes out first
      const key = NUMERIC.has(d.collection) ? Number(d.key) : d.key
      if (d.deleted || d.data === null) {
        if (this.sent.get(id) === null) continue
        this.sent.set(id, null)
        del.set(d.collection, [...(del.get(d.collection) ?? []), key])
      } else {
        const sig = sigOf(d.collection, d.data, d.owner_id)
        if (this.sent.get(id) === sig) continue // what we already have (our own push coming back)
        this.sent.set(id, sig)
        const row = fromServer(d.collection, d.data)
        if (d.collection === 'characters') (row as { ownerId?: number }).ownerId = d.owner_id ?? undefined
        put.set(d.collection, [...(put.get(d.collection) ?? []), row])
      }
      touched.add(d.collection)
    }
    if (touched.size) {
      const tables = [...touched].map((c) => this.table(c))
      await this.db.transaction('rw', tables, async () => {
        for (const c of touched) {
          if (put.has(c)) await this.table(c).bulkPut(put.get(c)!)
          if (del.has(c)) await this.table(c).bulkDelete(del.get(c)!)
        }
      })
    }
    // A player is only sent their own characters, so a character the DM handed to someone else just stops arriving: drop it here
    if (res.owned) {
      const owned = new Set(res.owned)
      const table = this.table('characters')
      const gone = (await table.toCollection().primaryKeys()).filter((k) => !owned.has(String(k)) && !this.dirty.has(idOf('characters', k)))
      if (gone.length) {
        gone.forEach((k) => this.sent.set(idOf('characters', k), null))
        await table.bulkDelete(gone)
      }
    }
    setIncomingRolls(res.rolls ?? [], this.campaignId) // numbers players typed on their phones (the DM's poll carries them)
    // items other players passed to characters this account owns (the characters were applied above, so they are here to receive them)
    if (res.gifts?.length) void receiveGifts(res.gifts, this.campaignId).catch(() => {})
    this.cursor = res.rev
    this.needFull = false
  }

  private async persist() {
    const value = { cursor: this.cursor, dirty: [...this.dirty.keys()] }
    const json = JSON.stringify(value)
    if (json === this.persisted) return
    this.persisted = json
    await this.db.kv.put({ key: STATE_KEY, value })
  }

  /** After a restore or an import: make the server match this database exactly (send what differs, delete what is gone). */
  async resyncAll() {
    const keep: Record<string, string[]> = {}
    for (const collection of COLLECTIONS) {
      const keys = (await this.table(collection).toCollection().primaryKeys()).map(String).filter((k) => !isLocalOnly(collection, k))
      keep[collection] = keys
      keys.forEach((k) => this.mark(collection, k))
    }
    await this.tick()
    await this.tick() // the first round's pull can re-mark records it just received (their owner); the second finds them unchanged
    if (this.dirty.size) throw new ApiError(0, 'offline') // not everything arrived: do not delete anything on the server
    await api.post(`/campaigns/${this.campaignId}/sync/prune`, { keep })
    await this.tick()
  }
}

/* ---------------------------------------------------------------- one engine for the open campaign */

let engine: Engine | undefined

export async function startSync(db: AppDB, campaignId: number, userId: number, onLost: (why: 'login' | 'campaign') => void) {
  await stopSync()
  setStatus({ state: 'syncing', pending: 0, ready: false })
  engine = new Engine(db, campaignId, userId, onLost)
  await engine.start()
}

export async function stopSync() {
  const old = engine
  engine = undefined
  await old?.stop()
}

export const resetSyncStatus = () => setStatus({ state: 'syncing', pending: 0, ready: false })
export const resyncAll = async () => engine?.resyncAll()
export const syncNow = async () => engine?.tick()
