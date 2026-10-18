import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { blobToDataUrl, shrinkImage } from './image'

/**
 * Maps and handouts. The DM keeps them in the Maps tab and can show one to the players, exactly like showing a character sheet (`spotlight.ts`): the player
 * screen shows the picture instead of the combat feed until it is switched off. Only one thing is shown at a time (a map or a sheet).
 *
 * Fog of war (planned): a map will get a mask of what the players may see. The picture sent to the table must then be COMPOSED here in the DM's browser with the
 * hidden parts blacked out, because anything sent as-is can be pulled out of the network traffic. `publicMap()` is the single place that decides what goes out.
 */
export interface MapShown {
  mapId: number
}

const KEY = 'mapShown'

export const useMaps = () => useLiveQuery(() => db.maps.orderBy('name').toArray(), []) ?? []
export const useMapShown = () => useLiveQuery(async () => ((await db.kv.get(KEY))?.value as MapShown | undefined) ?? null, [])

/** 1800 px is sharp on a phone and a TV and keeps the file a few hundred kilobytes (it travels as JSON to the table). */
export const addMap = async (file: File) =>
  db.maps.add({ name: file.name.replace(/\.[^.]+$/, '') || 'Map', image: await shrinkImage(file, 1800) })
export const renameMap = (id: number, name: string) => db.maps.update(id, { name })

export async function showMap(mapId: number) {
  await db.kv.delete('spotlight') // one thing at a time
  await db.kv.put({ key: KEY, value: { mapId } satisfies MapShown })
}
export const stopShowingMap = () => db.kv.delete(KEY)
export async function deleteMap(id: number) {
  const shown = (await db.kv.get(KEY))?.value as MapShown | undefined
  if (shown?.mapId === id) await stopShowingMap()
  await db.maps.delete(id)
}

/** What the table sees of a map. (Fog of war will black out the hidden parts here.) */
export interface PublicMap {
  name: string
  imageData: string
}
export async function publicMap(map: { name: string; image: Blob }): Promise<PublicMap> {
  return { name: map.name, imageData: await blobToDataUrl(map.image) }
}
