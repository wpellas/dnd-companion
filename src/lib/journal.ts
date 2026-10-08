import { db } from '../db'
import type { CombatState, JournalEntry } from '../types'
import { getCampaign } from './store'

/** The DM's campaign journal: notes, session recaps, and a summary of every fight that ends. Nothing here reaches the player view. */

export const KIND_LABEL: Record<JournalEntry['kind'], string> = { note: 'Note', session: 'Session', combat: 'Combat', loot: 'Loot' }

export async function addEntry(kind: JournalEntry['kind'], title: string, body = ''): Promise<number> {
  const now = Date.now()
  const { day } = await getCampaign()
  return (await db.journal.add({ kind, title, body, day, createdAt: now, updatedAt: now })) as number
}

export const updateEntry = (id: number, patch: Partial<Pick<JournalEntry, 'kind' | 'title' | 'body' | 'day' | 'pinned'>>) =>
  db.journal.update(id, { ...patch, updatedAt: Date.now() })

export const deleteEntry = (id: number) => db.journal.delete(id)

/** "3× Goblin Warrior, Wolf" from the monsters of a fight. */
function monsterSummary(names: string[]): string {
  const counts = new Map<string, number>()
  for (const n of names) {
    const base = n.replace(/ \d+$/, '')
    counts.set(base, (counts.get(base) ?? 0) + 1)
  }
  return [...counts].map(([n, k]) => (k > 1 ? `${k}× ${n}` : n)).join(', ')
}

/** Write the finished fight into the journal: who fought, how it ended, XP, and the DM's combat log. */
export async function addCombatSummary(state: CombatState) {
  const monsters = state.combatants.filter((c) => c.kind === 'monster')
  const party = state.combatants.filter((c) => c.kind === 'pc')
  const defeated = monsters.filter((c) => c.hp === 0)
  const xp = defeated.reduce((n, c) => n + (c.xp ?? 0), 0)
  const down = party.filter((c) => c.hp === 0)
  const lines = [
    `Enemies: ${monsters.length ? monsterSummary(monsters.map((c) => c.name)) : 'none'}`,
    `Defeated: ${defeated.length} of ${monsters.length}${xp ? ` (${xp} XP)` : ''}`,
    `Party after the fight: ${party.map((c) => `${c.name} ${c.hp}/${c.maxHp}`).join(', ') || 'none'}${down.length ? ` - down: ${down.map((c) => c.name).join(', ')}` : ''}`,
  ]
  if (state.log.length) lines.push('', 'Combat log:', ...state.log.map((l) => `- ${l}`))
  const title = `Combat: ${monsters.length ? monsterSummary(monsters.map((c) => c.name)) : 'a skirmish'} (${state.round} round${state.round === 1 ? '' : 's'})`
  await addEntry('combat', title, lines.join('\n'))
}
