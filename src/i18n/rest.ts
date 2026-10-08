import type { Msg } from './types'

/** Short and long rests. */
export const rest = {
  'rest.short': ['☾ Short rest', '☾ Kort vila'],
  'rest.long': ['☀ Long rest', '☀ Lång vila'],
  'rest.shortIntro': [
    'About an hour. Spend Hit Dice to heal ({how}). Short-rest features recharge, Warlocks regain their Pact Magic slots, and Arcane Recovery-style features can give slots back.',
    'Ungefär en timme. Använd vilotärningar för att läka ({how}). Förmågor som laddas om vid kort vila återfås, häxmästare får tillbaka sina Pact Magic-platser, och förmågor som Arcane Recovery kan ge tillbaka platser.',
  ],
  'rest.howRoll': ['roll them here or type what the players rolled', 'slå dem här eller skriv in vad spelarna slog'],
  'rest.howType': ['the players roll their own dice - type the total they rolled', 'spelarna slår sina egna tärningar - skriv in summan de slog'],
  'rest.longIntro': [
    'About eight hours. Everyone regains all Hit Points, half their Hit Dice (minimum 1), all spell slots and all feature uses, and loses one Exhaustion level.',
    'Ungefär åtta timmar. Alla får tillbaka alla träffpoäng, hälften av sina vilotärningar (minst 1), alla besvärjelseplatser och alla förmågeanvändningar, och förlorar en utmattningsnivå.',
  ],
  'rest.colCharacter': ['Character', 'Karaktär'],
  'rest.colHp': ['HP', 'HP'],
  'rest.colHitDice': ['Hit dice', 'Vilotärningar'],
  'rest.colSpend': ['Spend', 'Använd'],
  'rest.colRegained': ['HP regained', 'Återfått HP'],
  'rest.colRecovers': ['Recovers', 'Återfår'],
  'rest.rollNote': ['d{die}: [{rolls}] {con} CON each', 'd{die}: [{rolls}] {con} KON var'],
  'rest.longRecovers': ['+{n} hit dice, HP {hp}', '+{n} vilotärningar, HP {hp}'],
  'rest.full': ['full', 'full'],
  'rest.exhaustDrop': [', Exhaustion {a} → {b}', ', utmattning {a} → {b}'],
  'rest.takeShort': ['Take short rest', 'Ta kort vila'],
  'rest.takeLong': ['Take long rest', 'Ta lång vila'],
  'rest.oneUse': ['{name} (1 use)', '{name} (1 användning)'],
  'rest.pactSlots': ['Pact Magic slots', 'Pact Magic-platser'],

  // slot recovery (Arcane Recovery and friends)
  'rest.recSlots.one': [
    'recover slots worth up to {count} level (none above {max})',
    'återfå platser värda upp till {count} nivå (inga över {max})',
  ],
  'rest.recSlots.other': [
    'recover slots worth up to {count} levels (none above {max})',
    'återfå platser värda upp till {count} nivåer (inga över {max})',
  ],
  'rest.recPoints.one': ['regain up to {count} Sorcery Point', 'återfå upp till {count} Sorcery Point'],
  'rest.recPoints.other': ['regain up to {count} Sorcery Points', 'återfå upp till {count} Sorcery Points'],
  'rest.leftN': ['{n} left', '{n} kvar'],
  'rest.levelN': ['Level {n}', 'Nivå {n}'],
  'rest.fewer': ['Recover fewer level {n} slots', 'Återfå färre nivå {n}-platser'],
  'rest.recoverOne': ['Recover a level {n} slot', 'Återfå en nivå {n}-plats'],
  'rest.ofSpent': ['of {n} spent', 'av {n} förbrukade'],
  'rest.pointsAria': ['Sorcery Points to regain', 'Sorcery Points att återfå'],
} as const satisfies Record<string, Msg>
