import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, srdDb } from '../db'
import { t } from './i18n'
import { equipmentGroup, itemFromEquipment, itemFromMagicItem, type CatalogGroup } from './inventory'
import { newId } from './id'
import { getEquipment, getMagicItem, LIBRARY_SYNC_KEY, readCachedEquipment, readCachedMagicItems } from './srdApi'
import type { Item } from '../types'

/** One line of the "add an item" picker: everything in the SRD equipment and magic item lists, plus the DM's own items. */
export interface CatalogEntry {
  source: 'equipment' | 'magic-items' | 'custom'
  index: string
  name: string
  group: CatalogGroup
  hint?: string
  /** Weapons: the damage type, shown translated after the hint */
  damageType?: string
}

let cache: { count: number; list: CatalogEntry[] } | null = null

/** The SRD equipment and magic items from the locally stored library, for the picker. */
export async function loadCatalog(): Promise<CatalogEntry[]> {
  const [eq, magic] = await Promise.all([readCachedEquipment(), readCachedMagicItems()])
  if (cache?.count === eq.length + magic.length) return cache.list
  const list: CatalogEntry[] = [
    ...eq.map((e): CatalogEntry => ({ source: 'equipment', index: e.index, name: e.name, ...equipmentGroup(e) })),
    ...magic.map((m): CatalogEntry => ({ source: 'magic-items', index: m.index, name: m.name, group: 'magic', hint: m.rarity?.name })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  cache = { count: eq.length + magic.length, list }
  return list
}

/** The DM's own item list (templates: kv `customItems`, synced like the rest of the campaign). Like custom monsters, picked copies are independent. */
export const useCustomItems = (): Item[] => useLiveQuery(async () => ((await db.kv.get('customItems'))?.value as Item[] | undefined) ?? [], []) ?? []
export const saveCustomItems = (list: Item[]) => db.kv.put({ key: 'customItems', value: list })

/** The picker's entries (custom items first); the SRD part may be empty or partial until the one-time library download has finished. */
export function useItemCatalog(): CatalogEntry[] {
  const synced = useLiveQuery(async () => (await srdDb.kv.get(LIBRARY_SYNC_KEY)) ?? null, [])
  const custom = useCustomItems()
  const [list, setList] = useState<CatalogEntry[]>(cache?.list ?? [])
  useEffect(() => {
    let off = false
    loadCatalog().then((l) => !off && setList(l))
    return () => {
      off = true
    }
  }, [synced])
  return useMemo(
    () => [
      ...custom.filter((i) => i.name.trim()).map((i): CatalogEntry => ({ source: 'custom', index: i.id, name: i.name, group: 'custom', hint: t(`kind.${i.kind}`) })),
      ...list,
    ],
    [custom, list],
  )
}

/** Build an inventory item from a picker entry (fetches the details if they aren't stored yet). */
export async function buildItem(entry: CatalogEntry, custom: Item[]): Promise<Item> {
  if (entry.source === 'custom') {
    const found = custom.find((i) => i.id === entry.index)
    if (!found) throw new Error('custom item gone')
    return { ...structuredClone(found), id: newId() }
  }
  return entry.source === 'equipment' ? itemFromEquipment(await getEquipment(entry.index)) : itemFromMagicItem(await getMagicItem(entry.index))
}
