import type { Msg } from './types'

/** Spell levels and the words around them. Spell names themselves are never translated. */
export const spells = {
  'spell.cantrip': ['Cantrip', 'Cantrip'],
  'spell.cantrips': ['Cantrips', 'Cantrips'],
  'spell.ord.1': ['1st', '1'],
  'spell.ord.2': ['2nd', '2'],
  'spell.ord.3': ['3rd', '3'],
  'spell.ord.4': ['4th', '4'],
  'spell.ord.5': ['5th', '5'],
  'spell.ord.6': ['6th', '6'],
  'spell.ord.7': ['7th', '7'],
  'spell.ord.8': ['8th', '8'],
  'spell.ord.9': ['9th', '9'],
  'spell.level': ['{level} level', 'Nivå {level}'],
  'spell.slots': ['{level} slots', 'Nivå {level}-platser'],
  'spell.slot': ['{level} slot', 'Nivå {level}-plats'],
} as const satisfies Record<string, Msg>
