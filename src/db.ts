import Dexie, { type EntityTable } from 'dexie'
import { CLASS_HIT_DIE, CLASS_SAVES, guessClassIndex } from './lib/classes'
import type { Character, CombatState, Encounter, JournalEntry, MonsterTemplate } from './types'

/** Generic key-value store: `api:*` keys cache SRD API responses, other keys hold settings and campaign counters. */
export interface KvRecord {
  key: string
  value: unknown
}

class AppDB extends Dexie {
  characters!: EntityTable<Character, 'id'>
  /** Custom monsters only: the SRD bestiary is read from the cached API library, not stored here */
  monsters!: EntityTable<MonsterTemplate, 'id'>
  combat!: EntityTable<CombatState, 'id'>
  kv!: EntityTable<KvRecord, 'key'>
  encounters!: EntityTable<Encounter, 'id'>
  journal!: EntityTable<JournalEntry, 'id'>

  constructor() {
    super('dnd-companion')
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
  }
}

export const db = new AppDB()
