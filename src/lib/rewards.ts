import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { CombatState } from '../types'
import { canLevelUp, emptyCoins, splitEvenly } from './inventory'
import { t } from './i18n'
import { addEntry } from './journal'

/** Handing out experience and gold: after a fight, or whenever the party finds treasure. */

/** What the last finished fight was worth, kept until the DM awards or dismisses it. */
export interface LastFight {
  xp: number
  defeated: string[]
  /** Characters who were in the fight */
  characterIds: number[]
  at: number
}

const LAST_FIGHT_KEY = 'lastFight'

export const getLastFight = async () => (await db.kv.get(LAST_FIGHT_KEY))?.value as LastFight | undefined
export const clearLastFight = () => db.kv.delete(LAST_FIGHT_KEY)
export const useLastFight = () => useLiveQuery(async () => ((await db.kv.get(LAST_FIGHT_KEY))?.value as LastFight | undefined) ?? null, [])

/** Remember a finished fight's XP (defeated monsters only) so it can be awarded to the party. */
export async function rememberFight(state: CombatState) {
  const defeated = state.combatants.filter((c) => c.kind === 'monster' && c.hp === 0)
  const xp = defeated.reduce((n, c) => n + (c.xp ?? 0), 0)
  const characterIds = state.combatants.filter((c) => c.kind === 'pc' && c.characterId !== undefined).map((c) => c.characterId!)
  if (!xp || !characterIds.length) return
  const value: LastFight = { xp, defeated: defeated.map((c) => c.name), characterIds, at: Date.now() }
  await db.kv.put({ key: LAST_FIGHT_KEY, value })
}

export interface AwardInput {
  ids: number[]
  /** Totals, split evenly between the characters */
  xp: number
  gp: number
  /** Why: "Goblin ambush", "The dragon's hoard" */
  note?: string
}

export interface AwardLine {
  id: number
  name: string
  xp: number
  gp: number
  levelUp: boolean
}

/** Split XP and gold evenly between the chosen characters, save it on their sheets and record it in the journal. */
export async function awardRewards({ ids, xp, gp, note }: AwardInput): Promise<AwardLine[]> {
  const xpEach = splitEvenly(xp, ids.length)
  const gpEach = splitEvenly(gp, ids.length)
  const lines: AwardLine[] = []
  await db.transaction('rw', db.characters, async () => {
    for (const [i, id] of ids.entries()) {
      const c = await db.characters.get(id)
      if (!c) continue
      const next = { ...c, xp: (c.xp ?? 0) + xpEach[i], coins: { ...emptyCoins(), ...c.coins } }
      next.coins.gp += gpEach[i]
      await db.characters.put(next)
      lines.push({ id, name: c.name, xp: xpEach[i], gp: gpEach[i], levelUp: canLevelUp(next) && !canLevelUp(c) })
    }
  })
  if (lines.length) {
    const parts = [xp ? `${xp.toLocaleString()} XP` : '', gp ? `${gp.toLocaleString()} gp` : ''].filter(Boolean)
    const body = [
      note?.trim(),
      ...lines.map((l) => `${l.name}: ${[l.xp ? `${l.xp} XP` : '', l.gp ? `${l.gp} gp` : ''].filter(Boolean).join(', ') || t('journal.nothing')}${l.levelUp ? t('journal.levelUpTag') : ''}`),
    ].filter(Boolean)
    await addEntry('loot', t('journal.awarded', { what: parts.join(t('journal.and')) || t('journal.nothing') }), body.join('\n'))
  }
  return lines
}

/** Award the last fight's XP evenly to the characters who fought. */
export async function awardLastFight(): Promise<AwardLine[]> {
  const f = await getLastFight()
  if (!f) return []
  const present = (await db.characters.bulkGet(f.characterIds)).filter((c) => !!c).map((c) => c!.id!)
  const lines = await awardRewards({ ids: present, xp: f.xp, gp: 0, note: t('journal.fightNote', { names: f.defeated.join(', ') }) })
  await clearLastFight()
  return lines
}
