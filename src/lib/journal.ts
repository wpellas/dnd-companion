import { db } from '../db'
import type { CombatState, JournalEntry } from '../types'
import { MESSAGES } from '../i18n/messages'
import { t, tn } from './i18n'
import { getCampaign } from './store'

/** The DM's campaign journal: notes, session recaps, and a summary of every fight that ends. Nothing here reaches the player view. */

export const kindLabel = (kind: JournalEntry['kind']) => t(`jkind.${kind}`)

/**
 * A combat entry's body is the result followed by the log under a heading. The heading is in the language the entry
 * was written in, so look for it in every language.
 */
export function splitCombatLog(body: string): [head: string, log: string] {
  for (const heading of MESSAGES['journal.logHeading']) {
    const at = body.indexOf(`\n\n${heading}\n`)
    if (at >= 0) return [body.slice(0, at), body.slice(at + heading.length + 3)]
  }
  return [body, '']
}

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
    t('journal.enemies', { list: monsters.length ? monsterSummary(monsters.map((c) => c.name)) : t('journal.none') }),
    `${t('journal.defeated', { n: defeated.length, total: monsters.length })}${xp ? ` (${xp} XP)` : ''}`,
    `${t('journal.party', { list: party.map((c) => `${c.name} ${c.hp}/${c.maxHp}`).join(', ') || t('journal.none') })}${down.length ? t('journal.down', { names: down.map((c) => c.name).join(', ') }) : ''}`,
  ]
  if (state.log.length) lines.push('', t('journal.logHeading'), ...state.log.map((l) => `- ${l}`))
  const title = tn('journal.combatTitle', state.round, { what: monsters.length ? monsterSummary(monsters.map((c) => c.name)) : t('journal.skirmish') })
  await addEntry('combat', title, lines.join('\n'))
}
