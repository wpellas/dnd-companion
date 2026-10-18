import { db, srdDb } from '../db'

/**
 * From before accounts the browser kept everything in one database (now `srdDb`, which stays the home of the SRD library). Copy the user's
 * data into the open campaign: the sync engine then sends it to the server. Ids are kept, so links between records (journal entries
 * about a character...) still hold; only the fight in progress is left behind.
 */
export const legacyCharacterCount = () => srdDb.characters.count()

export async function importLegacy(): Promise<number> {
  const [characters, monsters, encounters, journal, kv] = await Promise.all([
    srdDb.characters.toArray(),
    srdDb.monsters.where('source').equals('custom').toArray(),
    srdDb.encounters.toArray(),
    srdDb.journal.toArray(),
    srdDb.kv.toArray(),
  ])
  await db.transaction('rw', [db.characters, db.monsters, db.encounters, db.journal, db.kv], async () => {
    await db.characters.bulkPut(characters)
    await db.monsters.bulkPut(monsters)
    await db.encounters.bulkPut(encounters)
    await db.journal.bulkPut(journal)
    await db.kv.bulkPut(kv.filter((r) => !r.key.startsWith('api:') && r.key !== 'lastBackup'))
  })
  return characters.length
}
