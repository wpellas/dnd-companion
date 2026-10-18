import type { Msg } from './types'

/** The group check / "who notices?" panel on the Party page. */
export const checks = {
  'checks.title': ['Checks (group check, who notices?)', 'Slag (gruppslag, vem märker?)'],
  'checks.clear': ['Clear totals', 'Rensa summor'],
  'checks.who': ['Character', 'Rollperson'],
  'checks.passive': ['Passive Perception', 'Passiv Perception'],
  'checks.total': ['Total rolled', 'Slagen summa'],
  'checks.result': ['Result', 'Resultat'],
  'checks.pass': ['Success', 'Lyckas'],
  'checks.fail': ['Fails', 'Misslyckas'],
  'checks.group': ['Group check: {ok} of {n} succeed.', 'Gruppslag: {ok} av {n} lyckas.'],
  'checks.groupPass': ['The group succeeds (at least half).', 'Gruppen lyckas (minst hälften).'],
  'checks.groupFail': ['The group fails.', 'Gruppen misslyckas.'],
  'checks.note': ['Type what each player rolled (the d20 plus their bonus), or they can send it from their phone. Passive Perception is 10 + their Perception bonus.', 'Skriv vad varje spelare slog (d20 plus bonus), eller så kan de skicka det från mobilen. Passiv Perception är 10 + deras Perception-bonus.'],
} as const satisfies Record<string, Msg>
