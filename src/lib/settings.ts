import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Lang } from './i18n'

export interface Settings {
  /**
   * Whether the app may roll dice for player characters (their attacks, saves, initiative, hit dice...).
   * Off by default: players roll their own dice at the table and tell the DM the number. The app only ever supplies
   * the bonuses and rules around the roll. Dice for monsters are the DM's and can always be rolled in the app.
   */
  allowPlayerAppRolls: boolean
  /** Monsters of the same kind share one initiative (rolled once, or typed once), the way many tables run big groups */
  groupInitiative: boolean
  /** Interface language for the DM and, through the live view, everyone else */
  language: Lang
}

export const DEFAULT_SETTINGS: Settings = { allowPlayerAppRolls: false, groupInitiative: false, language: 'en' }

const KEY = 'settings'

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await db.kv.get(KEY))?.value as Partial<Settings> | undefined) }
}

export async function updateSettings(patch: Partial<Settings>) {
  await db.kv.put({ key: KEY, value: { ...(await getSettings()), ...patch } })
}

/** Current settings; defaults while loading. */
export function useSettings(): Settings {
  return useLiveQuery(getSettings, []) ?? DEFAULT_SETTINGS
}

/** May the app roll a die for this kind of creature? Monsters: always (the DM's dice). Players: only if enabled. */
export const canAppRoll = (kind: 'pc' | 'monster' | 'lair', settings: Settings) => kind !== 'pc' || settings.allowPlayerAppRolls

/** The language saved in the database, or undefined while loading and when none was ever chosen (a phone showing the live view has none). */
export const useStoredLanguage = () =>
  useLiveQuery(async () => ((await db.kv.get(KEY))?.value as Partial<Settings> | undefined)?.language ?? null, [])
