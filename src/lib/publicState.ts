import type { Combatant, CombatState, Condition, PublicEvent } from '../types'
import { hpStatus, type HpStatus } from './combat'

/**
 * What the table is allowed to see. This is the only thing ever sent to other devices: monsters appear with a
 * Healthy / Bloodied / Defeated status and no HP, AC, saves or actions; the DM's log and undo history stay private.
 */
export interface PublicCombatant {
  id: string
  kind: Combatant['kind']
  name: string
  characterId?: number
  initiative: number | null
  /** Player characters only */
  hp?: number
  maxHp?: number
  tempHp?: number
  deathSaves?: { successes: number; failures: number }
  status: HpStatus
  conditions: Condition[]
  concentrating: boolean
}

export interface PublicCombat {
  combatants: PublicCombatant[]
  round: number
  turnIndex: number
  started: boolean
  events: PublicEvent[]
}

export function toPublic(s: CombatState | undefined): PublicCombat | undefined {
  if (!s) return undefined
  return {
    round: s.round,
    turnIndex: s.turnIndex,
    started: s.started,
    events: s.events ?? [],
    combatants: s.combatants.map((c): PublicCombatant => {
      const base = {
        id: c.id,
        kind: c.kind,
        name: c.name,
        characterId: c.characterId,
        initiative: c.initiative,
        status: hpStatus(c),
        conditions: c.conditions ?? [],
        concentrating: c.concentrating,
      }
      return c.kind === 'pc' ? { ...base, hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp, deathSaves: c.hp === 0 ? c.deathSaves : undefined } : base
    }),
  }
}
