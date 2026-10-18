import type { Msg } from './types'

/** Pictures for enemy creatures. */
export const avatars = {
  'avatar.title': ['Choose a picture for every {name} (the players see it too)', 'Välj en bild för alla {name} (spelarna ser den också)'],
  'avatar.add': ['Add pictures', 'Lägg till bilder'],
  'avatar.addTitle': ['Several pictures can be added at once', 'Flera bilder kan läggas till samtidigt'],
  'avatar.removeShown': ['Remove the picture shown on this creature', 'Ta bort bilden som visas på den här varelsen'],
  'avatar.manyHint': ['With several pictures, the 1st goblin of a fight gets the 1st picture, the 2nd the 2nd, and so on; extra goblins get a random one.', 'Med flera bilder får den 1:a goblinen i en strid den 1:a bilden, den 2:a den 2:a osv.; överskjutande goblins får en slumpad.'],
  'avatar.remove': ['Remove the picture', 'Ta bort bilden'],
  'avatar.failed': ['Could not read that picture.', 'Kunde inte läsa bilden.'],
} as const satisfies Record<string, Msg>
