import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Combatant } from '../types'
import { shrinkImage } from './image'

/**
 * Pictures for creature types, so the DM can give enemies the faces players have. A bestiary entry has one or more pictures: an SRD monster is keyed by
 * its index, a custom one by its id, anything else by name; the first picture is stored under that key, further ones under `key#1`, `key#2`...
 * The table sees them too.
 */
export const avatarKey = (ref?: { srdIndex?: string; templateId?: number; name: string }) =>
  ref ? (ref.srdIndex ?? (ref.templateId !== undefined ? `custom-${ref.templateId}` : `name-${ref.name.toLowerCase()}`)) : undefined

/** All avatars by storage key (empty while loading). */
export const useAvatars = () => useLiveQuery(async () => new Map((await db.avatars.toArray()).map((a) => [a.key, a.image])), []) ?? new Map<string, Blob>()

export interface Picture {
  key: string
  blob: Blob
}

const indexOf = (k: string) => (k.includes('#') ? Number(k.split('#')[1]) : 0)

/** The pictures of one bestiary entry, in order. */
export const avatarList = (all: Map<string, Blob>, base?: string): Picture[] =>
  base
    ? [...all]
        .filter(([k]) => k === base || k.startsWith(`${base}#`))
        .sort((a, b) => indexOf(a[0]) - indexOf(b[0]))
        .map(([key, blob]) => ({ key, blob }))
    : []

const hash = (s: string) => [...s].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7)

/**
 * Which picture this creature shows: the 1st goblin of the fight gets the 1st picture, the 2nd the 2nd... and once the pictures run out, a stable
 * pseudo-random one (by the creature's id, so it does not change on every render). Adding pictures later re-deals them live.
 */
export function pictureFor(c: Combatant, all: Combatant[], pictures: Map<string, Blob>): Picture | undefined {
  const base = avatarKey(c.templateRef)
  const list = avatarList(pictures, base)
  if (!list.length) return undefined
  const n = all.filter((x) => x.kind === 'monster' && avatarKey(x.templateRef) === base).findIndex((x) => x.id === c.id)
  return n >= 0 && n < list.length ? list[n] : list[hash(c.id) % list.length]
}

export const setAvatar = async (key: string, file: Blob) => void (await db.avatars.put({ key, image: await shrinkImage(file) }))
export const clearAvatar = (key: string) => db.avatars.delete(key)

/** Add one more picture to an entry (the first free slot). */
export async function addAvatar(base: string, file: Blob) {
  const taken = new Set(await db.avatars.toCollection().primaryKeys())
  let key = base
  for (let n = 1; taken.has(key); n++) key = `${base}#${n}`
  await setAvatar(key, file)
}

/** Replace all of an entry's pictures with this list. */
export async function replaceAvatars(base: string, files: Blob[]) {
  const all = new Map((await db.avatars.toArray()).map((a) => [a.key, a.image]))
  await db.avatars.bulkDelete(avatarList(all, base).map((p) => p.key))
  for (const [i, f] of files.entries()) await setAvatar(i === 0 ? base : `${base}#${i}`, f)
}
