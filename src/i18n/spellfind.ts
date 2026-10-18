import type { Msg } from './types'

/** The DM's spell finder: who can cast what. */
export const spellfind = {
  'spellfind.title': ['Spells at the table (who can cast what?)', 'Besvärjelser vid bordet (vem kan kasta vad?)'],
  'spellfind.search': ['Search a spell the party knows…', 'Sök en besvärjelse sällskapet kan…'],
  'spellfind.clear': ['Show everyone', 'Visa alla'],
  'spellfind.none': ['No character has spellcasting yet.', 'Ingen rollperson har besvärjelser än.'],
  'spellfind.nobody': ['Nobody has {spell} prepared.', 'Ingen har {spell} förberedd.'],
  'spellfind.cantrip': ['cantrip', 'trick'],
  'spellfind.cantrips': ['Cantrips:', 'Tricks:'],
  'spellfind.level': ['Level {n}', 'Nivå {n}'],
  'spellfind.always': ['at will', 'obegränsat'],
  'spellfind.noSlot': ['no slot left', 'ingen plats kvar'],
  'spellfind.slots.one': ['{count} slot to spare', '{count} plats över'],
  'spellfind.slots.other': ['{count} slots to spare', '{count} platser över'],
} as const satisfies Record<string, Msg>
