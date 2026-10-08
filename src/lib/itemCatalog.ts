import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { equipmentGroup, itemFromEquipment, itemFromMagicItem } from './inventory'
import { getEquipment, getMagicItem, LIBRARY_SYNC_KEY, readCachedEquipment, readCachedMagicItems } from './srdApi'
import type { Item } from '../types'

/** One line of the "add an item" picker: everything in the SRD equipment and magic item lists. */
export interface CatalogEntry {
  source: 'equipment' | 'magic-items'
  index: string
  name: string
  group: string
  hint?: string
}

let cache: { count: number; list: CatalogEntry[] } | null = null

/** The SRD equipment and magic items from the locally stored library, for the picker. */
export async function loadCatalog(): Promise<CatalogEntry[]> {
  const [eq, magic] = await Promise.all([readCachedEquipment(), readCachedMagicItems()])
  if (cache?.count === eq.length + magic.length) return cache.list
  const list: CatalogEntry[] = [
    ...eq.map((e): CatalogEntry => ({ source: 'equipment', index: e.index, name: e.name, ...equipmentGroup(e) })),
    ...magic.map((m): CatalogEntry => ({ source: 'magic-items', index: m.index, name: m.name, group: 'Magic items', hint: m.rarity?.name })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  cache = { count: eq.length + magic.length, list }
  return list
}

/** The picker's entries; may be empty or partial until the one-time library download has finished. */
export function useItemCatalog(): CatalogEntry[] {
  const synced = useLiveQuery(async () => (await db.kv.get(LIBRARY_SYNC_KEY)) ?? null, [])
  const [list, setList] = useState<CatalogEntry[]>(cache?.list ?? [])
  useEffect(() => {
    let off = false
    loadCatalog().then((l) => !off && setList(l))
    return () => {
      off = true
    }
  }, [synced])
  return list
}

/** Build an inventory item from a picker entry (fetches the details if they aren't stored yet). */
export async function buildItem(entry: CatalogEntry): Promise<Item> {
  return entry.source === 'equipment' ? itemFromEquipment(await getEquipment(entry.index)) : itemFromMagicItem(await getMagicItem(entry.index))
}
