import { t } from './i18n'

/** The eight 2024 Weapon Mastery properties (stored as the SRD's English names; the explanation is translated). */
const KEYS = {
  Cleave: 'mastery.Cleave',
  Graze: 'mastery.Graze',
  Nick: 'mastery.Nick',
  Push: 'mastery.Push',
  Sap: 'mastery.Sap',
  Slow: 'mastery.Slow',
  Topple: 'mastery.Topple',
  Vex: 'mastery.Vex',
} as const

/** What the property does, or undefined for a name we do not know. */
export const masteryText = (name?: string) => (name && name in KEYS ? t(KEYS[name as keyof typeof KEYS]) : undefined)

/** Graze is the one that works on a miss; the others need a hit. */
export const masteryOnMiss = (name?: string) => name === 'Graze'
