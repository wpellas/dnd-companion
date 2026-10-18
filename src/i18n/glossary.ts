import type { Msg } from './types'

/** Help for players: the "?" legend, what a tapped badge means, and the condition note in the announcements. */
export const glossary = {
  'gloss.title': ['What do the words mean?', 'Vad betyder orden?'],
  'gloss.diceHint': ['(Advantage: roll two d20s, use the higher. Disadvantage: roll two d20s, use the lower.)', '(Fördel: slå två d20 och använd det högsta. Nackdel: slå två d20 och använd det lägsta.)'],
  'gloss.effectUnknown': ['a spell or effect on this creature. Ask the DM what it does.', 'en besvärjelse eller effekt på varelsen. Fråga spelledaren vad den gör.'],
  'gloss.form': ['{form}: this character has taken a beast\'s shape (Wild Shape) and uses its stats until it returns to normal.', '{form}: rollpersonen har antagit ett djurs form (Vildform) och använder dess värden tills den blir normal igen.'],
  'gloss.colours': ['Condition colours', 'Färger på tillstånd'],
  'gloss.colours.text': ['Red: cannot act. Orange: hindered. Blue: hidden (Invisible).', 'Röd: kan inte agera. Orange: hindrad. Blå: dold (Osynlig).'],
  'gloss.advantage': ['Advantage', 'Fördel'],
  'gloss.advantage.text': ['Roll two d20s and use the higher one.', 'Slå två d20 och använd det högsta.'],
  'gloss.disadvantage': ['Disadvantage', 'Nackdel'],
  'gloss.disadvantage.text': ['Roll two d20s and use the lower one. If you have both Advantage and Disadvantage, they cancel and you roll one d20.', 'Slå två d20 och använd det lägsta. Har du både fördel och nackdel tar de ut varandra och du slår en d20.'],
  'gloss.resistance': ['Resistance', 'Resistens'],
  'gloss.resistance.text': ['You take half damage of that type (rounded down).', 'Du tar halv skada av den typen (avrundat nedåt).'],
  'gloss.vulnerability': ['Vulnerability', 'Sårbarhet'],
  'gloss.vulnerability.text': ['You take double damage of that type.', 'Du tar dubbel skada av den typen.'],
  'gloss.immunity': ['Immunity', 'Immunitet'],
  'gloss.immunity.text': ['You take no damage of that type, or can\'t be given that condition.', 'Du tar ingen skada av den typen, eller kan inte få det tillståndet.'],
  'gloss.concentration': ['Concentration', 'Koncentration'],
  'gloss.concentration.text': ['Some spells last only while the caster keeps focusing on them. Taking damage or being knocked out can break it (the DM asks for a Constitution save).', 'Vissa besvärjelser varar bara så länge kastaren fokuserar på dem. Att ta skada eller bli utslagen kan bryta den (spelledaren ber om en Constitution-räddning).'],
  'gloss.tempHp': ['Temporary hit points', 'Tillfälliga hitpoints'],
  'gloss.tempHp.text': ['An extra buffer: damage uses it up first. It does not add to your normal hit points and can\'t be healed back.', 'En extra buffert: skadan tas från den först. Den läggs inte på dina vanliga hitpoints och kan inte läkas tillbaka.'],
  'gloss.deathSaves': ['Death saves', 'Dödsräddningar'],
  'gloss.deathSaves.text': ['At 0 hit points you roll a d20 each turn: 10 or more is a success, less is a failure (a 1 counts as two, a 20 brings you back with 1 hit point). Three successes make you stable, three failures mean death.', 'Vid 0 hitpoints slår du en d20 varje tur: 10 eller mer är en lyckad, mindre en misslyckad (en 1:a räknas som två, en 20:a tar dig tillbaka med 1 hitpoint). Tre lyckade gör dig stabil, tre misslyckade betyder döden.'],
  'gloss.inspiration': ['Heroic Inspiration', 'Heroisk inspiration'],
  'gloss.inspiration.text': ['You can reroll one die and must use the new roll. Then it is spent.', 'Du kan slå om en tärning och måste använda det nya slaget. Därefter är den förbrukad.'],
  'gloss.bloodied': ['Bloodied', 'Blodig'],
  'gloss.bloodied.text': ['An enemy at half its hit points or fewer. Healthy is more than half; Defeated is out of the fight.', 'En fiende på hälften av sina hitpoints eller mindre. Frisk är mer än hälften; Besegrad är ur striden.'],

  'ann.condition': ['{name} is now {cond}: {what}', '{name} är nu {cond}: {what}'],
} as const satisfies Record<string, Msg>
