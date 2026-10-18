import { useSyncExternalStore } from 'react'
import { api } from './api'

/**
 * Numbers players typed on their own phones (they rolled the physical die). They arrive with the DM's sync poll, wait here, and fill in
 * the matching field of a panel when the DM gets to it. Nothing ever waits for them: they are a shortcut, not a step.
 * `initiative` is a total (d20 + bonus); `attack` and `save` are the d20 itself, because the panels add the bonus.
 */
export type RollKind = 'initiative' | 'attack' | 'save'

export interface IncomingRoll {
  id: number
  /** The character's id in the campaign (the key of its record) */
  character: string
  kind: RollKind
  value: number
  at: string
}

export const ROLL_MAX: Record<RollKind, number> = { initiative: 60, attack: 20, save: 20 }

let rolls: IncomingRoll[] = []
let campaignId: number | undefined
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Called by the sync engine with whatever the server says is waiting (an empty list when the campaign closes). */
export function setIncomingRolls(next: IncomingRoll[], campaign?: number) {
  campaignId = campaign
  if (JSON.stringify(next) === JSON.stringify(rolls)) return
  rolls = next
  notify()
}

export const useIncomingRolls = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => rolls,
  )

export const rollFor = (list: IncomingRoll[], characterId: number | undefined, kind: RollKind) =>
  characterId === undefined ? undefined : list.find((r) => r.character === String(characterId) && r.kind === kind)

/** The DM used the roll or does not want it: it is gone from the screen at once and from the server a moment later. */
export function consumeRoll(id: number) {
  rolls = rolls.filter((r) => r.id !== id)
  notify()
  if (campaignId !== undefined) void api.delete(`/campaigns/${campaignId}/rolls/${id}`).catch(() => undefined)
}

/** The waiting number of this kind for this character, and a way to take it. */
export function useSentRoll(characterId: number | undefined, kind: RollKind) {
  const roll = rollFor(useIncomingRolls(), characterId, kind)
  return { roll, take: () => roll && consumeRoll(roll.id) }
}

/** A player sends a number for one of their own characters. */
export const sendRoll = (campaign: number, character: number, kind: RollKind, value: number) =>
  api.post(`/campaigns/${campaign}/rolls`, { character: String(character), kind, value })
