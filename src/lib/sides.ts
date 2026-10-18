import type { Combatant } from '../types'

/** On the party's side: a PC or an ally. Enemies are the other monsters. (Own file: combat.ts, rewards.ts and journal.ts all need it.) */
export const isParty = (c: Pick<Combatant, 'kind' | 'ally'>) => c.kind === 'pc' || !!c.ally
export const isEnemy = (c: Pick<Combatant, 'kind' | 'ally'>) => c.kind === 'monster' && !c.ally
