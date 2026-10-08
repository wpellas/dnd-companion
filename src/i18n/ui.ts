import type { Msg } from './types'

/** Small shared widgets: pips, initiative box, damage type lists. */
export const ui = {
  'ui.use': ['use', 'användning'],
  'ui.uses': ['uses', 'användningar'],
  'ui.remaining': ['{label} remaining', '{label} kvar'],
  'ui.spent': ['spent', 'förbrukad'],
  'ui.available': ['available', 'tillgänglig'],
  'ui.init': ['Init', 'Init'],
  'ui.remove': ['Remove {what}', 'Ta bort {what}'],
  'ui.add': ['Add {what}', 'Lägg till {what}'],
  'ui.addEllipsis': ['+ add…', '+ lägg till…'],
  'ui.none': ['none', 'ingen'],
} as const satisfies Record<string, Msg>
