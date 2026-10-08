import type { AbilityScores } from '../types'

export const abilityMod = (score: number) => Math.floor((score - 10) / 2)

export const formatMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export const rollDie = (sides: number) => Math.floor(Math.random() * sides) + 1

export const rollInitiative = (bonus: number) => rollDie(20) + bonus

interface Dice {
  count: number
  sides: number
  mod: number
}

/** Parses "2d6+3", "d8", "1d10-1" or a flat "5". Returns null if it isn't a dice expression. */
export function parseDice(expr: string): Dice | null {
  const s = expr.replace(/\s/g, '').toLowerCase()
  if (/^\d+$/.test(s)) return { count: 0, sides: 0, mod: Number(s) }
  const m = s.match(/^(\d*)d(\d+)([+-]\d+)?$/)
  if (!m) return null
  const dice = { count: m[1] ? Number(m[1]) : 1, sides: Number(m[2]), mod: m[3] ? Number(m[3]) : 0 }
  return dice.count > 0 && dice.sides > 0 ? dice : null
}

/** Rolls a dice expression. A critical hit doubles the dice (not the flat modifier). */
export function rollDice(expr: string, crit = false): { total: number; note: string } | null {
  const d = parseDice(expr)
  if (!d) return null
  const count = crit ? d.count * 2 : d.count
  const rolls = Array.from({ length: count }, () => rollDie(d.sides))
  const total = rolls.reduce((a, b) => a + b, 0) + d.mod
  const modText = d.mod ? formatMod(d.mod) : ''
  const note = count ? `[${rolls.join(', ')}]${modText}${crit ? ' (crit)' : ''}` : `${d.mod}`
  return { total: Math.max(0, total), note }
}

export const defaultAbilities = (): AbilityScores => ({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
})
