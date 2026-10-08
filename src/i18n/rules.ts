import type { Msg } from './types'

/** Rules helpers: what each condition does, advantage hints, roll notes, difficulty labels. */
export const rules = {
  // one-line reminders per condition (shown on the creature's turn)
  'remind.Blinded': [
    "Can't see; its attack rolls have Disadvantage and attacks against it have Advantage.",
    'Kan inte se; dess attackkast har nackdel och attacker mot den har fördel.',
  ],
  'remind.Charmed': [
    "Can't attack or harm the charmer; the charmer has Advantage on social checks against it.",
    'Kan inte attackera eller skada den som charmat den; den har fördel på sociala färdighetsprov mot den.',
  ],
  'remind.Deafened': ["Can't hear; fails ability checks that need hearing.", 'Kan inte höra; misslyckas med färdighetsprov som kräver hörsel.'],
  'remind.Exhaustion': [
    'Each Exhaustion level: -2 to every D20 Test and -5 ft Speed. Dies at level 6.',
    'Varje utmattningsnivå: -2 på varje D20-test och -5 ft fart. Dör på nivå 6.',
  ],
  'remind.Frightened': [
    "Disadvantage on ability checks and attack rolls while the source of fear is in sight; can't move closer to it.",
    'Nackdel på färdighetsprov och attackkast medan rädslans källa är synlig; kan inte flytta sig närmare den.',
  ],
  'remind.Grappled': ['Speed 0; Disadvantage on attacks against anyone but the grappler.', 'Fart 0; nackdel på attacker mot alla utom den som håller fast den.'],
  'remind.Incapacitated': [
    "Can't take actions, Bonus Actions or Reactions; Concentration is broken; can't speak.",
    'Kan inte utföra handlingar, bonushandlingar eller reaktioner; koncentrationen bryts; kan inte tala.',
  ],
  'remind.Invisible': [
    'Its attack rolls have Advantage and attacks against it have Disadvantage (unless it can be seen somehow).',
    'Dess attackkast har fördel och attacker mot den har nackdel (om den inte kan ses på något sätt).',
  ],
  'remind.Paralyzed': [
    'Incapacitated, Speed 0; fails STR and DEX saves; attacks against it have Advantage; hits from within 5 ft are Critical Hits.',
    'Oförmögen, fart 0; misslyckas med STY- och FIN-räddningar; attacker mot den har fördel; träffar inom 5 ft är kritiska träffar.',
  ],
  'remind.Petrified': [
    'Incapacitated, Speed 0; fails STR and DEX saves; attacks against it have Advantage; Resistance to all damage; immune to Poisoned.',
    'Oförmögen, fart 0; misslyckas med STY- och FIN-räddningar; attacker mot den har fördel; resistens mot all skada; immun mot Förgiftad.',
  ],
  'remind.Poisoned': ['Disadvantage on attack rolls and ability checks.', 'Nackdel på attackkast och färdighetsprov.'],
  'remind.Prone': [
    'Disadvantage on attack rolls; attacks against it have Advantage from within 5 ft, otherwise Disadvantage. Standing up costs half its Speed.',
    'Nackdel på attackkast; attacker mot den har fördel inom 5 ft, annars nackdel. Att resa sig kostar halva farten.',
  ],
  'remind.Restrained': [
    'Speed 0; its attack rolls and DEX saves have Disadvantage; attacks against it have Advantage.',
    'Fart 0; dess attackkast och FIN-räddningar har nackdel; attacker mot den har fördel.',
  ],
  'remind.Stunned': [
    'Incapacitated; fails STR and DEX saves; attacks against it have Advantage.',
    'Oförmögen; misslyckas med STY- och FIN-räddningar; attacker mot den har fördel.',
  ],
  'remind.Unconscious': [
    'Incapacitated and Prone, Speed 0; fails STR and DEX saves; attacks against it have Advantage; hits from within 5 ft are Critical Hits.',
    'Oförmögen och liggande, fart 0; misslyckas med STY- och FIN-räddningar; attacker mot den har fördel; träffar inom 5 ft är kritiska träffar.',
  ],
  'remind.exhaustionLevel': [
    'Level {n}: -{pen} to every D20 Test (the app applies it to attack and save bonuses) and -{ft} ft Speed. Dies at level 6.',
    'Nivå {n}: -{pen} på varje D20-test (appen drar av det från attack- och räddningsbonusar) och -{ft} ft fart. Dör på nivå 6.',
  ],

  // why a roll has advantage / disadvantage
  'reason.attackerIs': ['attacker is {cond}', 'angriparen är {cond}'],
  'reason.attackerFrightened': [
    'attacker is Frightened (while the source of fear is in sight)',
    'angriparen är Rädd (medan rädslans källa är synlig)',
  ],
  'reason.attackerGrappled': ['attacker is Grappled (unless attacking the grappler)', 'angriparen är Gripen (om den inte attackerar den som håller fast den)'],
  'reason.targetIs': ['target is {cond}', 'målet är {cond}'],
  'reason.proneNear': ['target is Prone (within 5 ft)', 'målet är Liggande (inom 5 ft)'],
  'reason.proneFar': ['target is Prone (farther than 5 ft)', 'målet är Liggande (längre bort än 5 ft)'],
  'reason.crit': ['target is {cond} and the attacker is within 5 ft', 'målet är {cond} och angriparen är inom 5 ft'],

  // dice notes
  'roll.rolled': ['rolled {v}', 'slog {v}'],
  'roll.rolledTwo': ['rolled {a} & {b} ({how})', 'slog {a} och {b} ({how})'],
  'roll.advantage': ['advantage', 'fördel'],
  'roll.disadvantage': ['disadvantage', 'nackdel'],
  'roll.crit': [' (crit)', ' (kritisk)'],

  'detail.autoHit': ['auto-hit', 'träffar alltid'],

  // encounter difficulty
  'diff.Low': ['Low', 'Låg'],
  'diff.Moderate': ['Moderate', 'Måttlig'],
  'diff.High': ['High', 'Hög'],
  'diff.Beyond High': ['Beyond High', 'Bortom hög'],

  // armor class from gear
  'ac.unarmored': ['Unarmored {n}', 'Utan rustning {n}'],
  'ac.unarmoredDefense': ['Unarmored Defense {n}', 'Försvar utan rustning {n}'],
  'ac.severalArmors': ['Several body armors are equipped; only the best counts.', 'Flera rustningar är utrustade; bara den bästa räknas.'],
} as const satisfies Record<string, Msg>
