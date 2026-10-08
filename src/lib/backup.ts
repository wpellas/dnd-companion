import { db } from '../db'

/**
 * Whole-app backup as one JSON file: characters (with portraits), custom monsters, saved encounters, the journal, the
 * current fight, settings and the campaign counters. The downloaded SRD reference library is *not* included - it is
 * re-downloaded on first launch - so backups stay small.
 */
const FORMAT = 'dnd-companion-backup'
const VERSION = 1

interface BlobRef {
  __blob: string // data URL
}

const isBlobRef = (v: unknown): v is BlobRef => typeof v === 'object' && v !== null && '__blob' in v

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** Walk a plain-data value, swapping Blobs for data URLs (export) or back again (import). */
async function mapBlobs(value: unknown, toData: boolean): Promise<unknown> {
  if (toData && value instanceof Blob) return { __blob: await blobToDataUrl(value) }
  if (!toData && isBlobRef(value)) return await (await fetch(value.__blob)).blob()
  if (Array.isArray(value)) return Promise.all(value.map((v) => mapBlobs(v, toData)))
  if (value && typeof value === 'object' && !(value instanceof Blob)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = await mapBlobs(v, toData)
    return out
  }
  return value
}

export const BACKUP_KEY = 'lastBackup'

export async function exportBackup(): Promise<{ blob: Blob; filename: string; counts: Record<string, number> }> {
  const [characters, monsters, encounters, combat, kv, journal] = await Promise.all([
    db.characters.toArray(),
    db.monsters.where('source').equals('custom').toArray(),
    db.encounters.toArray(),
    db.combat.toArray(),
    db.kv.toArray(),
    db.journal.toArray(),
  ])
  const data = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    characters,
    monsters,
    encounters,
    combat,
    journal,
    kv: kv.filter((r) => !r.key.startsWith('api:') && r.key !== BACKUP_KEY),
  }
  const json = JSON.stringify(await mapBlobs(data, true))
  await db.kv.put({ key: BACKUP_KEY, value: Date.now() })
  const stamp = new Date().toISOString().slice(0, 10)
  return {
    blob: new Blob([json], { type: 'application/json' }),
    filename: `dnd-companion-backup-${stamp}.json`,
    counts: { characters: characters.length, monsters: monsters.length, encounters: encounters.length, journal: journal.length },
  }
}

/** Replace the app's data with the contents of a backup file. Throws a readable error if it isn't one. */
export async function importBackup(file: File): Promise<Record<string, number>> {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (raw.format !== FORMAT) throw new Error("That doesn't look like a D&D Companion backup file.")
  if (typeof raw.version !== 'number' || raw.version > VERSION) throw new Error('This backup was made by a newer version of the app.')
  const data = (await mapBlobs(raw, false)) as Record<string, unknown[]>
  const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as never[]) : [])

  await db.transaction('rw', [db.characters, db.monsters, db.encounters, db.combat, db.kv, db.journal], async () => {
    await db.characters.clear()
    await db.journal.clear()
    await db.monsters.where('source').equals('custom').delete()
    await db.encounters.clear()
    await db.combat.clear()
    // keep the downloaded reference library; replace only user data
    // keep the downloaded library and the record of when the user last backed up (they just used a backup)
    const keep = (await db.kv.toArray()).filter((r) => r.key.startsWith('api:') || r.key === BACKUP_KEY).map((r) => r.key)
    await db.kv.where('key').noneOf(keep).delete()
    await db.characters.bulkPut(arr('characters'))
    await db.monsters.bulkPut(arr('monsters'))
    await db.encounters.bulkPut(arr('encounters'))
    await db.combat.bulkPut(arr('combat'))
    await db.journal.bulkPut(arr('journal'))
    await db.kv.bulkPut(arr('kv'))
  })
  return { characters: arr('characters').length, monsters: arr('monsters').length, encounters: arr('encounters').length, journal: arr('journal').length }
}

/** Trigger a browser download of a blob. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
