import type { Msg } from './types'

/** Movement without a map: the bar under the turn's action pills. */
export const movement = {
  'lbl.move': ['{name}: movement', '{name}: förflyttning'],
  'move.line': ['Moved {used} / {total} ft', 'Gått {used} / {total} ft'],
  'move.title': ['Count the feet by hand: there is no map. Speed includes Haste, Slow and Exhaustion.', 'Räkna fötterna för hand: det finns ingen karta. Farten inkluderar Haste, Slow och Utmattning.'],
  'move.less': ['5 feet less', '5 fot mindre'],
  'move.more': ['5 feet more', '5 fot mer'],
  'move.dash': ['Dash', 'Dash'],
  'move.dashTitle': ['Uses the action; adds the creature\'s Speed as extra movement', 'Använder handlingen; ger varelsens fart som extra förflyttning'],
  'move.disengage': ['Disengage', 'Disengage'],
  'move.disengageTitle': ['Uses the action; moving away provokes no opportunity attacks this turn', 'Använder handlingen; att gå därifrån ger inga tillfällesattacker denna tur'],
  'move.stand': ['Stand up', 'Res dig'],
  'move.standTitle': ['Standing up from Prone costs half the Speed ({ft} ft)', 'Att resa sig från liggande kostar halva farten ({ft} ft)'],
  'move.over': ['{n} ft over its Speed', '{n} ft över farten'],
  'move.oa': ['Leaving an enemy\'s reach provokes an opportunity attack (a Reaction).', 'Att lämna en fiendes räckvidd ger en tillfällesattack (en Reaktion).'],
  'move.disengaged': ['Disengaged: no opportunity attacks this turn.', 'Disengage: inga tillfällesattacker denna tur.'],
} as const satisfies Record<string, Msg>
