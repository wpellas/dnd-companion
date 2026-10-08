import { db } from '../db'
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

export async function applyShortRest(inputs: ({ id: number } & ShortRestInput)[]) {
  await db.transaction('rw', db.characters, db.kv, async () => {
    for (const { id, ...input } of inputs) {
      const c = await db.characters.get(id)
      if (c) await db.characters.put(shortRest(c, input))
    }
    const camp = await getCampaign()
    await setCampaign({ ...camp, shortRestsSinceLong: camp.shortRestsSinceLong + 1 })
  })
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
}
