import { useSyncExternalStore } from 'react'
import { MESSAGES, type MessageKey } from '../i18n/messages'
import type { Ability, ClassIndex, Condition } from '../types'

/**
 * Interface language. The DM picks it in Settings and it is what everyone sees (the live view follows the DM's choice).
 * Only the app's own words are translated: spell, monster, item and class-feature names and rules text come from the
 * SRD and stay in English.
 *
 * `t()` reads the current language at call time, so it also works outside React (the combat log, the announcements the
 * players see). The React tree is re-created when the language changes (see main.tsx), which re-runs every `t()` call.
 */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'sv', name: 'Svenska' },
] as const
export type Lang = (typeof LANGUAGES)[number]['code']

const INDEX: Record<Lang, number> = { en: 0, sv: 1 }
const STORAGE_KEY = 'dnd-companion:lang'

const isLang = (v: unknown): v is Lang => LANGUAGES.some((l) => l.code === v)

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (isLang(v)) return v
  } catch {
    /* private mode or no storage: fall through */
  }
  return 'en'
}

let current: Lang = readStored()
if (typeof document !== 'undefined') document.documentElement.lang = current
const listeners = new Set<() => void>()

export const getLang = () => current

/** Switch language (remembered on this device so the next launch starts in it, before the database has loaded). */
export function setLang(next: Lang) {
  if (next === current || !isLang(next)) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach((l) => l())
}

export const useLang = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )

export type Params = Record<string, string | number>

const fill = (text: string, params?: Params) => (params ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`)) : text)

/** The text for a key in the current language; `{name}` placeholders are filled from `params`. */
export function t(key: MessageKey, params?: Params): string {
  const entry = MESSAGES[key]
  return fill(entry[INDEX[current]] || entry[0], params)
}

/** Keys that have a `.one` and `.other` form (singular / plural). */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer B}.one` ? B : never) : never

/** Singular or plural wording for a count; `{count}` is filled in automatically. */
export const tn = (base: PluralKey, count: number, params?: Params) => t(`${base}.${count === 1 ? 'one' : 'other'}` as MessageKey, { count, ...params })

/** "Merlin's" / Swedish "Merlins" (names ending in s, x or z take no extra s): for "X's turn" and the like. */
export const possessive = (name: string) => (current === 'sv' ? (/[sxz]$/i.test(name) ? name : `${name}s`) : `${name}'s`)

/** Locale for dates and numbers. */
export const locale = (): string | undefined => (current === 'sv' ? 'sv-SE' : undefined)

/* Rules vocabulary: the stored values stay English (they are logic keys), these give the words shown. */
export const tCondition = (c: Condition) => t(`cond.${c}`)
export const tAbility = (a: Ability) => t(`abil.${a}`)
export const tClass = (c?: ClassIndex) => (c ? t(`cls.${c}`) : undefined)
/** A monster type ("dragon") or size ("Large") from the SRD; anything unknown is shown as it is. */
export function tMonsterType(type: string): string {
  const key = `mtype.${type.toLowerCase()}` as MessageKey
  return key in MESSAGES ? t(key) : type
}
export function tSize(size: string): string {
  const key = `msize.${size}` as MessageKey
  return key in MESSAGES ? t(key) : size
}
/** A damage type word ("fire"); unknown or empty values are shown as they are. */
export function tDamage(type: string): string {
  const key = `dmg.${type.toLowerCase()}` as MessageKey
  return key in MESSAGES ? t(key) : type
}
