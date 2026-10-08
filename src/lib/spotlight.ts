import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

/**
 * "Display to players": the DM picks one character and the player view shows that sheet instead of the combat feed,
 * until it is switched off. It is only a view switch: it never touches the fight, and the feed returns exactly as it was.
 */
export interface Spotlight {
  characterId: number
  /** Show the inventory, coins and XP too (the DM may want those private) */
  inventory: boolean
}

const KEY = 'spotlight'

export const getSpotlight = async () => (await db.kv.get(KEY))?.value as Spotlight | undefined
export const useSpotlight = () => useLiveQuery(async () => ((await db.kv.get(KEY))?.value as Spotlight | undefined) ?? null, [])

export const showToPlayers = async (characterId: number) => {
  const prev = await getSpotlight()
  await db.kv.put({ key: KEY, value: { characterId, inventory: prev?.inventory ?? true } satisfies Spotlight })
}
export const stopShowing = () => db.kv.delete(KEY)
export const setSpotlightInventory = async (inventory: boolean) => {
  const s = await getSpotlight()
  if (s) await db.kv.put({ key: KEY, value: { ...s, inventory } })
}
