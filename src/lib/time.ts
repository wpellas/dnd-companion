import type { Light } from '../types'
import type { Campaign } from './store'
import { newId } from './id'
import { t } from './i18n'

/** Campaign time (pure): the clock in minutes since midnight, and light sources that burn down while it runs. */
export const START_MINUTES = 8 * 60

export const clockOf = (c: Pick<Campaign, 'minutes'>) => c.minutes ?? START_MINUTES
export const clockText = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Dawn 05-07, day 07-18, dusk 18-20, night otherwise (a reminder of how dark it is, not a rule). */
export const periodOf = (minutes: number) => {
  const h = minutes / 60
  return h >= 7 && h < 18 ? 'day' : h >= 5 && h < 7 ? 'dawn' : h >= 18 && h < 20 ? 'dusk' : 'night'
}

/** Light sources from the 2024 equipment text (Torch 1 hour; Candle 1 hour; Lamp and the lanterns burn a flask of oil for 6 hours). */
export const LIGHT_PRESETS: { name: string; minutes: number; bright: string; dim: string }[] = [
  { name: 'Torch', minutes: 60, bright: '20 ft', dim: '+20 ft' },
  { name: 'Candle', minutes: 60, bright: '5 ft', dim: '+5 ft' },
  { name: 'Lamp', minutes: 360, bright: '15 ft', dim: '+30 ft' },
  { name: 'Hooded Lantern', minutes: 360, bright: '30 ft', dim: '+30 ft' },
  { name: 'Bullseye Lantern', minutes: 360, bright: '60-ft cone', dim: '+60 ft' },
  { name: 'Light (spell)', minutes: 60, bright: '20 ft', dim: '+20 ft' },
]

export const newLight = (p: { name: string; minutes: number; bright: string; dim: string }): Light => ({ id: newId(), name: p.name, left: p.minutes, lit: true, bright: p.bright, dim: p.dim })

/** Lit lights burn down by `minutes` (never below 0). */
export const burn = (c: Campaign, minutes: number): Campaign => ({
  ...c,
  lights: c.lights?.map((l) => (l.lit ? { ...l, left: Math.max(0, l.left - minutes), lit: l.left - minutes > 0 } : l)),
})

/** The campaign after `minutes` have passed: the clock and day move on, and lit lights burn down. */
export function advance(c: Campaign, minutes: number): Campaign {
  const total = clockOf(c) + Math.max(0, Math.round(minutes))
  return { ...burn(c, minutes), day: c.day + Math.floor(total / 1440), minutes: total % 1440 }
}

/** Move the clock to the next occurrence of a time of day (dawn = 06:00). */
export const minutesUntil = (c: Pick<Campaign, 'minutes'>, target: number) => (target - clockOf(c) + 1440) % 1440 || 1440

export const lightLeftText = (l: Light) => (l.left <= 0 ? t('time.burnedOut') : l.left >= 60 ? t('time.hoursLeft', { h: Math.floor(l.left / 60), m: l.left % 60 }) : t('time.minLeft', { m: l.left }))
