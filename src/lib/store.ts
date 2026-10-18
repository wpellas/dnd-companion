import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../db'
import type { Character } from '../types'
import { castingSnapshot, proficiencyBonus, resolveCharacterActions } from './character'
import { withGearAc } from './inventory'
import { buildSaves } from './resolve'
import { longRest, shortRest, type ShortRestInput } from './rest'

/** Database mutations on characters / campaign state (kept apart from the pure rules in rest.ts / spells.ts). */

export interface Campaign {
  /** In-world day; a long rest advances it. */
  day: number
  shortRestsSinceLong: number
}

const DEFAULT_CAMPAIGN: Campaign = { day: 1, shortRestsSinceLong: 0 }

export async function getCampaign(): Promise<Campaign> {
  return ((await db.kv.get('campaign'))?.value as Campaign | undefined) ?? DEFAULT_CAMPAIGN
}

export const setCampaign = (value: Campaign) => db.kv.put({ key: 'campaign', value })

/** Spend one slot of `level` on a character. Does nothing if none are left. */
export async function spendSlot(characterId: number, level: number) {
  await db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(characterId)
    const slot = c?.spellcasting?.slots[level - 1]
    if (!c?.spellcasting || !slot || slot.used >= slot.max) return
    slot.used += 1
    await db.characters.put(c)
  })
}

/** Combatants are snapshots, so after a rest the party's entries in the idle fight still show the old HP; refresh them. */
async function syncPartyCombatants(ids: number[]) {
  const state = await db.combat.get('current')
  if (!state || state.started) return
  let changed = false
  for (const c of state.combatants) {
    if (c.kind !== 'pc' || c.characterId === undefined || !ids.includes(c.characterId)) continue
    const ch = await db.characters.get(c.characterId)
    if (!ch) continue
    c.hp = ch.currentHp
    c.maxHp = ch.maxHp
    c.exhaustion = ch.exhaustion ?? 0
    c.conditions = c.exhaustion > 0 ? (c.conditions.includes('Exhaustion') ? c.conditions : [...c.conditions, 'Exhaustion']) : c.conditions.filter((x) => x !== 'Exhaustion')
    changed = true
  }
  if (changed) await db.combat.put(state)
}

/**
 * Combatants are snapshots, so anything that changes a character mid-fight (new weapon, found item, AC, saves) is copied into their entry.
 * HP, conditions and the turn trackers stay as they are. Only writes when something differs.
 */
export async function syncPartyToFight() {
  await db.transaction('rw', db.combat, db.characters, async () => {
    const state = await db.combat.get('current')
    if (!state) return
    let changed = false
    for (const c of state.combatants) {
      if (c.kind !== 'pc' || c.characterId === undefined) continue
      const ch = await db.characters.get(c.characterId)
      if (!ch) continue
      const next = {
        ac: ch.ac,
        initiativeBonus: ch.initiativeBonus,
        actions: resolveCharacterActions(ch),
        casting: castingSnapshot(ch),
        saves: buildSaves(ch.abilities, { proficient: ch.saveProficiencies ?? [], proficiencyBonus: proficiencyBonus(ch.level) }),
        resistances: ch.resistances ?? [],
        immunities: ch.immunities ?? [],
        vulnerabilities: ch.vulnerabilities ?? [],
        inspired: ch.heroicInspiration || undefined,
      }
      if (JSON.stringify(pick(c, next)) === JSON.stringify(next)) continue
      Object.assign(c, next)
      changed = true
    }
    if (changed) await db.combat.put(state)
  })
}

const pick = (from: object, like: object) => Object.fromEntries(Object.keys(like).map((k) => [k, (from as Record<string, unknown>)[k]]))

/** Keep the running fight in step with the party (DM window only: the player view never writes). */
export function useFightSync(enabled: boolean) {
  const characters = useLiveQuery(() => db.characters.toArray(), [])
  useEffect(() => {
    if (enabled && characters) void syncPartyToFight()
  }, [enabled, characters])
}

export async function applyShortRest(inputs: ({ id: number } & ShortRestInput)[]) {
  await db.transaction('rw', db.characters, db.kv, async () => {
    for (const { id, ...input } of inputs) {
      const c = await db.characters.get(id)
      if (c) await db.characters.put(shortRest(c, input))
    }
    const camp = await getCampaign()
    await setCampaign({ ...camp, shortRestsSinceLong: camp.shortRestsSinceLong + 1 })
  })
  await syncPartyCombatants(inputs.map((i) => i.id))
}

export async function applyLongRest(ids: number[]) {
  await db.transaction('rw', db.characters, db.kv, async () => {
    for (const id of ids) {
      const c = await db.characters.get(id)
      if (c) await db.characters.put(longRest(c))
    }
    const camp = await getCampaign()
    await setCampaign({ day: camp.day + 1, shortRestsSinceLong: 0 })
  })
  await syncPartyCombatants(ids)
}

/** Change a character's inventory, coins or XP; Armor Class follows the equipped gear when that is switched on. */
export async function updateCharacter(id: number, patch: Partial<Character>) {
  await db.transaction('rw', db.characters, async () => {
    const c = await db.characters.get(id)
    if (c) await db.characters.put(withGearAc({ ...c, ...patch }))
  })
}
