import { db } from '../db'
import { XP_BY_CR, difficultyOf, partyBudget } from '../data/encounterBudget'
import type { Combatant, Encounter, EncounterEntry, MonsterTemplate } from '../types'
import { monsterCombatants, mutateCombat, pcCombatant, sortCombatants } from './combat'

/** The monster template an encounter entry points at (an SRD monster by index, or a custom one by id). */
export function templateFor(e: EncounterEntry, srd: MonsterTemplate[], custom: MonsterTemplate[]): MonsterTemplate | undefined {
  if (e.srdIndex) return srd.find((m) => m.srdIndex === e.srdIndex)
  if (e.templateId !== undefined) return custom.find((m) => m.id === e.templateId)
  return [...custom, ...srd].find((m) => m.name === e.name)
}

const xpOf = (t: MonsterTemplate) => t.xp ?? XP_BY_CR[t.cr] ?? 0

/** Total XP of an encounter (monsters the library can't find count as 0). */
export function encounterXp(entries: EncounterEntry[], srd: MonsterTemplate[], custom: MonsterTemplate[]) {
  return entries.reduce((sum, e) => {
    const t = templateFor(e, srd, custom)
    return sum + (t ? xpOf(t) * e.count : 0)
  }, 0)
}

/** How hard an encounter is for characters of the given levels, using the 2024 XP budgets. */
export function rateEncounter(totalXp: number, partyLevels: number[]) {
  const budget = partyBudget(partyLevels)
  return { budget, difficulty: partyLevels.length ? difficultyOf(totalXp, budget) : null }
}

/** Group the monsters of a running fight into encounter entries (several goblins become one entry with a count). */
export function entriesFromCombat(combatants: Combatant[]): EncounterEntry[] {
  const groups = new Map<string, EncounterEntry>()
  for (const c of combatants) {
    if (c.kind !== 'monster') continue
    const ref = c.templateRef ?? { name: c.name.replace(/ \d+$/, '') }
    const key = ref.srdIndex ?? (ref.templateId !== undefined ? `custom-${ref.templateId}` : ref.name)
    const g = groups.get(key)
    if (g) g.count += 1
    else groups.set(key, { srdIndex: ref.srdIndex, templateId: ref.templateId, name: ref.name, count: 1 })
  }
  return [...groups.values()]
}

/** Put an encounter's monsters into the fight (and the party too, if they aren't there yet). Returns what couldn't be found. */
export async function loadEncounter(enc: Encounter, srd: MonsterTemplate[], custom: MonsterTemplate[], addParty = true): Promise<string[]> {
  const characters = addParty ? await db.characters.toArray() : []
  const missing: string[] = []
  await mutateCombat((s) => {
    if (addParty) {
      const present = new Set(s.combatants.map((c) => c.characterId))
      for (const ch of characters) if (!present.has(ch.id)) s.combatants.push(pcCombatant(ch))
    }
    for (const e of enc.entries) {
      const t = templateFor(e, srd, custom)
      if (!t) {
        missing.push(e.name)
        continue
      }
      s.combatants.push(...monsterCombatants(t, e.count, s.combatants))
    }
    if (s.started) sortCombatants(s)
  }, `Loaded encounter "${enc.name}"`)
  return missing
}
