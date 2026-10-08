import { db } from '../db'
import { CLASSES, CONDITIONS } from '../types'

/**
 * Client for the free SRD 5.2 (2024 rules) API: https://www.dnd5eapi.co/api/2024
 * Responses are cached forever in IndexedDB (`kv`, keys `api:*`), so after the first fetch the app works offline.
 * SRD 5.2 content is CC-BY-4.0 (Wizards of the Coast); keep the attribution in the app.
 */
const BASE = 'https://www.dnd5eapi.co/api/2024'

export interface SrdClass {
  index: string
  name: string
  hit_die: number
  spellcasting?: { level: number; spellcasting_ability: { index: string } }
}

export interface SrdClassLevel {
  level: number
  /** Per-class columns of the class features table, e.g. { second_wind_uses: 2 } or { rage_count: 3 } */
  class_specific?: Record<string, unknown>
  spellcasting?: {
    cantrips_known?: number
    prepared_spells?: number
    [slots: `spell_slots_level_${number}`]: number | undefined
  }
}

export interface SrdSpellRef {
  index: string
  name: string
  level: number
}

export interface SrdSpell extends SrdSpellRef {
  casting_time: string
  range: string
  duration: string
  concentration: boolean
  ritual: boolean
  components: string[]
  description: string
  higher_level?: string
  attack_type?: 'melee' | 'ranged'
  damage?: {
    damage_type?: { name: string }
    damage_at_slot_level?: Record<string, string>
  }
  school?: { name: string }
  classes: { index: string; name: string }[]
}

async function cached<T>(path: string): Promise<T> {
  const key = `api:${path}`
  const hit = await db.kv.get(key)
  if (hit) return hit.value as T
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`SRD API returned ${res.status} for ${path}`)
  const value = (await res.json()) as T
  await db.kv.put({ key, value })
  return value
}

export const getClass = (index: string) => cached<SrdClass>(`/classes/${index}`)

export const getClassLevel = (index: string, level: number) =>
  cached<SrdClassLevel>(`/classes/${index}/levels/${Math.min(20, Math.max(1, level))}`)

export const getSpell = (index: string) => cached<SrdSpell>(`/spells/${index}`)

export async function getClassSpells(classIndex: string): Promise<SrdSpellRef[]> {
  const r = await cached<{ results: SrdSpellRef[] }>(`/classes/${classIndex}/spells`)
  return r.results
}

export interface SrdMonsterAction {
  name: string
  desc: string
  attack_bonus?: number
  damage?: { damage_type?: { index: string }; damage_dice: string }[]
  dc?: { dc_type: { index: string }; dc_value: number; success_type: string }
  usage?: { type: string; times?: number; min_value?: number }
  /** Multiattack: the attacks it makes (counts arrive as strings or numbers) and, if any, one more chosen from a list */
  multiattack_type?: string
  actions?: { action_name: string; count: number | string }[]
  action_options?: { choose: number; from?: { options?: { action_name?: string; count?: number | string }[] } }
  /** Spellcasting actions */
  spellcasting?: {
    ability: { index: string }
    dc?: number
    modifier?: number
    spells?: { index: string; name: string; level: number; usage?: { type: string; times?: number } }[]
  }
}

export interface SrdMonster {
  index: string
  name: string
  size: string
  type: string
  armor_class: { value: number }[]
  hit_points: number
  challenge_rating: number
  xp: number
  xp_in_lair?: number
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  speed: Record<string, string>
  actions: SrdMonsterAction[]
  bonus_actions: SrdMonsterAction[]
  reactions: SrdMonsterAction[]
  legendary_actions: SrdMonsterAction[]
  special_abilities: SrdMonsterAction[]
  proficiencies: { value: number; proficiency: { index: string } }[]
  damage_resistances: string[]
  damage_immunities: string[]
  damage_vulnerabilities: string[]
  condition_immunities: { index: string }[]
}

export const getMonster = (index: string) => cached<SrdMonster>(`/monsters/${index}`)

export async function getMonsterRefs(): Promise<{ index: string; name: string }[]> {
  return (await cached<{ results: { index: string; name: string }[] }>('/monsters')).results
}

export interface SrdCondition {
  index: string
  name: string
  description: string[] | string
}

export const getCondition = (index: string) => cached<SrdCondition>(`/conditions/${index}`)

/** Every stored SRD monster (after the library download), read straight from the local cache. */
export async function readCachedMonsters(): Promise<SrdMonster[]> {
  const rows = await db.kv.where('key').startsWith('api:/monsters/').toArray()
  return rows.map((r) => r.value as SrdMonster)
}

export async function getAllSpellRefs(): Promise<SrdSpellRef[]> {
  const r = await cached<{ results: SrdSpellRef[] }>('/spells')
  return r.results
}

/** kv key marking that the whole reference library (spells, classes, class level tables, monsters, conditions) has been downloaded. */
export const LIBRARY_SYNC_KEY = 'api:sync:library-v3'

let inflight: Promise<void> | null = null

/**
 * Download the SRD reference library into the local database, once: every spell, each class with its spell list, and
 * every class level table (spell slots, feature use counts). After the `LIBRARY_SYNC_KEY` flag is written nothing is
 * ever requested again, so spells, class tables and the pickers all work offline. Safe to call repeatedly or from
 * several tabs: concurrent calls share one run, and a Web Lock keeps separate tabs from downloading in parallel.
 * Rejects if offline; call again later to resume (anything already stored is skipped).
 */
export function ensureLibrary(onProgress?: (done: number, total: number) => void): Promise<void> {
  if (inflight) return inflight
  const run = async () => {
    if (await db.kv.get(LIBRARY_SYNC_KEY)) return
    const [refs, monsterRefs] = await Promise.all([getAllSpellRefs(), getMonsterRefs()])
    const jobs: (() => Promise<unknown>)[] = [
      ...refs.map((r) => () => getSpell(r.index)),
      ...monsterRefs.map((m) => () => getMonster(m.index)),
      ...CONDITIONS.map((c) => () => getCondition(c.toLowerCase())),
      ...CLASSES.flatMap((c) => [
        () => getClass(c.index),
        () => getClassSpells(c.index),
        ...Array.from({ length: 20 }, (_, i) => () => getClassLevel(c.index, i + 1)),
      ]),
    ]
    let done = 0
    let next = 0
    const worker = async () => {
      while (next < jobs.length) {
        await jobs[next++]()
        onProgress?.(++done, jobs.length)
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker))
    await db.kv.put({ key: LIBRARY_SYNC_KEY, value: { spells: refs.length, monsters: monsterRefs.length, classLevels: CLASSES.length * 20, at: Date.now() } })
  }
  inflight = (navigator.locks ? navigator.locks.request('srd-spell-sync', run) : run()).finally(() => {
    inflight = null
  })
  return inflight
}
