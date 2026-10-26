import type { Msg } from './types'

/** The Maps tab and showing a map to the players. */
export const maps = {
  'maps.title': ['Maps', 'Kartor'],
  'images.title': ['Images', 'Bilder'],
  'images.intro': ['Pictures for storytelling (a building, a group of enemies, a place): show one and the players\' screens switch to it, filling the whole display, until you go back to the feed.', 'Bilder till berättandet (en byggnad, en fiendegrupp, en plats): visa en så byter spelarnas skärmar till den, över hela skärmen, tills du går tillbaka till flödet.'],
  'images.upload': ['Upload images', 'Ladda upp bilder'],
  'images.empty': ['No images yet.', 'Inga bilder än.'],
  'maps.intro': ['Upload battle maps and handouts, then show one to the players: their screens switch to the picture until you go back to the feed.', 'Ladda upp stridskartor och handouts och visa en för spelarna: deras skärmar byter till bilden tills du går tillbaka till flödet.'],
  'maps.upload': ['Upload maps', 'Ladda upp kartor'],
  'maps.empty': ['No maps yet.', 'Inga kartor än.'],
  'maps.show': ['Show to players', 'Visa för spelarna'],
  'maps.hide': ['Stop showing', 'Sluta visa'],
  'maps.showing': ['Showing now', 'Visas nu'],
  'maps.rename': ['Rename', 'Byt namn'],
  'maps.renamePrompt': ['Name', 'Namn'],
  'maps.delete': ['Delete', 'Ta bort'],
  'maps.deleteConfirm': ['Delete "{name}"?', 'Ta bort "{name}"?'],
  'maps.failed': ['Could not read that picture.', 'Kunde inte läsa bilden.'],
  'maps.shownBar': ['The players are looking at {name}.', 'Spelarna tittar på {name}.'],
  'maps.fogSoon': ['Fog of war is planned: you will be able to hide the map and reveal it piece by piece.', 'Dimma över kartan är planerad: du kommer kunna dölja kartan och avslöja den bit för bit.'],
} as const satisfies Record<string, Msg>
