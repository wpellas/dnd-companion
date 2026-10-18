import type { Msg } from './types'

/** Ammunition and charges at the table. */
export const ammo = {
  'ammo.less': ['One less', 'En mindre'],
  'ammo.more': ['One more', 'En till'],
  'ammo.out': ['out of ammunition', 'slut på ammunition'],
} as const satisfies Record<string, Msg>
