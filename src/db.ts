import Dexie, { type EntityTable } from 'dexie'
import { CLASS_HIT_DIE, CLASS_SAVES, guessClassIndex } from './lib/classes'
import type { Avatar, Character, MapRecord, CombatState, Encounter, JournalEntry, MonsterTemplate } from './types'

/** Generic key-value store: `api:*` keys cache SRD API responses, other keys hold settings and campaign counters. */
export interface KvRecord {
  key: string
  value: unknown
}

export class AppDB extends Dexie {
  characters!: EntityTable<Character, 'id'>
  /** Custom monsters only: the SRD bestiary is read from the cached API library, not stored here */
  monsters!: EntityTable<MonsterTemplate, 'id'>
  combat!: EntityTable<CombatState, 'id'>
  kv!: EntityTable<KvRecord, 'key'>
  encounters!: EntityTable<Encounter, 'id'>
  journal!: EntityTable<JournalEntry, 'id'>
  /** Pictures for creature types, keyed by bestiary entry */
  avatars!: EntityTable<Avatar, 'key'>
  /** Maps and handouts the DM can show to the players */
  maps!: EntityTable<MapRecord, 'id'>

  constructor(name = 'dnd-companion') {
    super(name)
    this.version(1).stores({
      characters: '++id, name',
      monsters: '++id, name, source',
      combat: 'id',
    })
    // v2: creatures gained `actions`.
    this.version(2)
      .stores({
        characters: '++id, name',
        monsters: '++id, name, source',
        combat: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('monsters').toCollection().modify((m: MonsterTemplate) => {
          m.actions ??= []
        })
        await tx.table('characters').toCollection().modify((c: Character) => {
          c.actions ??= []
        })
      })
    // v3: class dropdown, hit dice, resources, spellcasting, and the kv store. Existing free-text classes
    // ("Fighter", "wizard 3"...) are matched to a class where possible.
    this.version(3)
      .stores({
        characters: '++id, name',
        monsters: '++id, name, source',
        combat: 'id',
        kv: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('characters').toCollection().modify((c: Character) => {
          c.classIndex ??= guessClassIndex(c.className)
          c.subclass ??= ''
          c.hitDie ??= (c.classIndex && CLASS_HIT_DIE[c.classIndex]) || 8
          c.hitDiceUsed ??= 0
          c.resources ??= []
        })
      })
    // v4: saved encounters; saving-throw proficiencies and damage resistances on characters. The four hand-typed
    // "SRD" monsters from the first versions are dropped: the full SRD bestiary now comes from the API library.
    this.version(4)
      .stores({
        characters: '++id, name',
        monsters: '++id, name, source',
        combat: 'id',
        kv: 'key',
        encounters: '++id, name',
      })
      .upgrade(async (tx) => {
        await tx.table('monsters').where('source').equals('srd').delete()
        await tx.table('characters').toCollection().modify((c: Character) => {
          c.saveProficiencies ??= (c.classIndex && CLASS_SAVES[c.classIndex]) || []
          c.resistances ??= []
          c.immunities ??= []
          c.vulnerabilities ??= []
        })
      })
    // v5: the campaign journal (notes, session recaps, combat summaries). No data to migrate.
    this.version(5).stores({
      characters: '++id, name',
      monsters: '++id, name, source',
      combat: 'id',
      kv: 'key',
      encounters: '++id, name',
      journal: '++id, kind, createdAt',
    })
    // v6: pictures for enemy creatures. No data to migrate.
    this.version(6).stores({
      characters: '++id, name',
      monsters: '++id, name, source',
      combat: 'id',
      kv: 'key',
      encounters: '++id, name',
      journal: '++id, kind, createdAt',
      avatars: 'key',
    })
    this.version(7).stores({
      characters: '++id, name',
      monsters: '++id, name, source',
      combat: 'id',
      kv: 'key',
      encounters: '++id, name',
      journal: '++id, kind, createdAt',
      avatars: 'key',
      maps: '++id, name',
    })
  }
}

/**
 * The browser's own database from before accounts. It still holds the downloaded SRD library (`api:*` in `kv`, shared by every campaign) and,
 * until the user imports it, their old data.
 */
export const srdDb = new AppDB()

/** The open campaign's local copy (the sync engine keeps it in step with the server). Until a campaign is opened it is the old database. */
let current: AppDB = srdDb
const opened = new Map<string, AppDB>()

/**
 * Everything imports `db`, so it forwards to whichever campaign is open now. One database per user and campaign keeps accounts and
 * campaigns apart on a shared computer. Switching happens before the UI of the new campaign renders.
 */
export const db: AppDB = new Proxy({} as AppDB, {
  get(_target, prop) {
    const value = Reflect.get(current, prop)
    return typeof value === 'function' ? value.bind(current) : value
  },
})

export function openCampaignDb(userId: number, campaignId: number): AppDB {
  const name = `dnd-companion-u${userId}-c${campaignId}`
  let found = opened.get(name)
  if (!found) opened.set(name, (found = new AppDB(name)))
  return (current = found)
}

export const closeCampaignDb = () => {
  current = srdDb
}
