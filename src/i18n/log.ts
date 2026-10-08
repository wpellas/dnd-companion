import type { Msg } from './types'

/** Lines of the combat log (DM only), announcements for the players, and the short notes inside them. */
export const log = {
  'log.begins': ['Combat begins', 'Striden börjar'],
  'undo.last': ['last change', 'senaste ändringen'],

  // concentration, recharge
  'log.keepsConc': ['{name} keeps concentrating (DC {dc})', '{name} behåller koncentrationen (DC {dc})'],
  'log.losesConc': [
    '{name} fails the concentration save (DC {dc}) and loses concentration',
    '{name} misslyckas med koncentrationsräddningen (DC {dc}) och tappar koncentrationen',
  ],
  'ann.losesConc': ['{name} loses concentration', '{name} tappar koncentrationen'],
  'log.recharges': ['{who} {action} recharges (rolled {roll})', '{who} {action} laddas om (slog {roll})'],
  'log.staysSpent': ['{who} {action} stays spent (rolled {roll}, needs {min}+)', '{who} {action} förblir förbrukad (slog {roll}, behöver {min}+)'],

  // damage and death
  'note.deathFail': ['death save failure ({n}/3)', 'misslyckad dödsräddning ({n}/3)'],
  'note.deathFailCrit': ['death save failures (crit) ({n}/3)', 'misslyckade dödsräddningar (kritisk) ({n}/3)'],
  'note.hasDied': ['has died', 'har dött'],
  'ann.died': ['{name} has died', '{name} har dött'],
  'note.massive': ['is killed outright (massive damage)', 'dödas direkt (massiv skada)'],
  'note.drops': ['drops to 0 HP and falls Unconscious', 'faller till 0 HP och blir medvetslös'],
  'ann.falls': ['{name} falls unconscious', '{name} faller medvetslös'],
  'note.defeated': ['is defeated', 'är besegrad'],
  'ann.defeated': ['{name} is defeated', '{name} är besegrad'],
  'note.concSave': ['concentration save DC {dc}', 'koncentrationsräddning DC {dc}'],
  'log.takes': ['{name} takes {amount} damage', '{name} tar {amount} skada'],
  'log.healed': ['{name} is healed for {amount}', '{name} får {amount} HP tillbaka'],
  'note.wakes': ['regains consciousness', 'återfår medvetandet'],
  'ann.wakes': ['{name} regains consciousness', '{name} återfår medvetandet'],
  'log.thirdFail': ['{name} fails their third death save and dies', '{name} misslyckas med sin tredje dödsräddning och dör'],
  'log.stable': ['{name} succeeds three death saves and is stable at 0 HP', '{name} lyckas med tre dödsräddningar och är stabil på 0 HP'],
  'ann.stable': ['{name} is stable', '{name} är stabil'],

  // resolving an action
  'log.casts': ['{a} casts {action} on {t}', '{a} kastar {action} på {t}'],
  'ann.casts': ['{a} casts {action}', '{a} kastar {action}'],
  'log.heals': ['{a} heals {t} for {n} ({action})', '{a} läker {t} för {n} ({action})'],
  'ann.healsPc': ['{a} heals {t} for {n}', '{a} läker {t} för {n}'],
  'ann.heals': ['{a} heals {t}', '{a} läker {t}'],
  'log.misses': ['{a} misses {t} ({action})', '{a} missar {t} ({action})'],
  'ann.misses': ['{a} misses {t}', '{a} missar {t}'],
  'log.savedDmg': ['{t} saves against {who} {action}, takes {dmg}', '{t} klarar räddningen mot {who} {action} och tar {dmg}'],
  'log.savedNone': ['{t} saves against {who} {action}, takes no damage', '{t} klarar räddningen mot {who} {action} och tar ingen skada'],
  'log.failedDmg': ['{t} fails the save against {who} {action}, takes {dmg}', '{t} misslyckas med räddningen mot {who} {action} och tar {dmg}'],
  'log.failedNone': ['{t} fails the save against {who} {action}, takes no damage', '{t} misslyckas med räddningen mot {who} {action} men tar ingen skada'],
  'ann.resists': ['{t} resists {who} {action}', '{t} motstår {who} {action}'],
  'ann.resistsDmg': ['{t} resists {who} {action} ({n} damage)', '{t} motstår {who} {action} ({n} skada)'],
  'ann.caught': ['{t} is caught by {who} {action}', '{t} fångas av {who} {action}'],
  'ann.caughtDmg': ['{t} is caught by {who} {action} ({n} damage)', '{t} fångas av {who} {action} ({n} skada)'],
  'log.hit': ['{a} hits {t} with {action} for {dmg}', '{a} träffar {t} med {action} för {dmg}'],
  'log.crit': ['{a} CRITS {t} with {action} for {dmg}', '{a} träffar {t} KRITISKT med {action} för {dmg}'],
  'ann.hit': ['{a} hits {t}', '{a} träffar {t}'],
  'ann.hitDmg': ['{a} hits {t} for {n}', '{a} träffar {t} för {n}'],
  'ann.crit': ['{a} critically hits {t}', '{a} träffar {t} kritiskt'],
  'ann.critDmg': ['{a} critically hits {t} for {n}', '{a} träffar {t} kritiskt för {n}'],
  'note.counterLeft': ['{name} ({n} left)', '{name} ({n} kvar)'],
  'note.immuneTo': ['immune to {cond}', 'immun mot {cond}'],
  'note.now': ['now {cond}', 'nu {cond}'],
  'note.slotLevel': ['level {n} slot', 'nivå {n}-plats'],
  'note.dropsConc': ['drops previous concentration', 'släpper tidigare koncentration'],
  'note.concentrating': ['concentrating', 'koncentrerar sig'],
  'log.uses': ['{a} uses {action}', '{a} använder {action}'],
  'log.usesMulti': ['{a} uses {action}{suffix}: {lines}', '{a} använder {action}{suffix}: {lines}'],

  // turn order
  'log.delays': ['{a} delays their turn until after {b}', '{a} skjuter upp sin tur till efter {b}'],
  'ann.delays': ['{a} delays their turn', '{a} skjuter upp sin tur'],
  'log.exhaustDies': ['{name} dies of exhaustion (level 6)', '{name} dör av utmattning (nivå 6)'],
  'log.exhaustLevel': ['{name} is at Exhaustion level {n}', '{name} har utmattningsnivå {n}'],

  // why an action can't be used
  'why.recharge': ['needs to recharge ({min}{upto})', 'måste laddas om ({min}{upto})'],
  'why.perDay': ['{n}/day used up', '{n}/dag förbrukade'],
  'why.rest': ['used until the next rest', 'använd tills nästa vila'],
  'why.legendary': ['no legendary actions left', 'inga legendariska handlingar kvar'],

  // damage adjusted for defences
  'effect.immune': ['immune', 'immun'],
  'effect.resist': ['resistant (halved)', 'resistent (halverad)'],
  'effect.vuln': ['vulnerable (doubled)', 'sårbar (dubblerad)'],
  'effect.both': ['resistant and vulnerable', 'resistent och sårbar'],
  'effect.damage': ['damage', 'skada'],
} as const satisfies Record<string, Msg>
