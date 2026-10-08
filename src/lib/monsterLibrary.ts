import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { srdToTemplate } from './monsters'
import { LIBRARY_SYNC_KEY, readCachedMonsters } from './srdApi'
import type { MonsterTemplate } from '../types'

let cache: { count: number; list: MonsterTemplate[] } | null = null

/** All SRD monsters converted to our templates, from the locally stored library. */
export async function loadSrdMonsters(): Promise<MonsterTemplate[]> {
  const rows = await readCachedMonsters()
  if (cache?.count === rows.length) return cache.list
  const list = rows.map(srdToTemplate).sort((a, b) => a.name.localeCompare(b.name))
  cache = { count: rows.length, list }
  return list
}

/**
 * The SRD bestiary for pickers and the Bestiary tab. `ready` turns true once the one-time library download has
 * finished; before that the list may be partial (or empty on the very first launch).
 */
export function useSrdMonsters(): { monsters: MonsterTemplate[]; ready: boolean } {
  const synced = useLiveQuery(async () => (await db.kv.get(LIBRARY_SYNC_KEY)) ?? null, [])
  const [monsters, setMonsters] = useState<MonsterTemplate[]>(cache?.list ?? [])
  useEffect(() => {
    let off = false
    loadSrdMonsters().then((l) => !off && setMonsters(l))
    return () => {
      off = true
    }
  }, [synced])
  return { monsters, ready: !!synced }
}

/** Custom (user-made) monsters from the local database. */
export function useCustomMonsters(): MonsterTemplate[] {
  return useLiveQuery(() => db.monsters.where('source').equals('custom').sortBy('name'), []) ?? []
}
