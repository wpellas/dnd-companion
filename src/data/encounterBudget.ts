/**
 * Encounter difficulty for the 2024 rules (Dungeon Master's Guide / SRD 5.2): each character has an XP budget for the
 * difficulty you're aiming at; the party's budget is that times the number of characters, and the encounter "costs" the
 * summed XP of its monsters. Table values per character level (Low / Moderate / High), checked against the published
 * 2024 table (levels 1, 2, 3, 20 confirmed by two independent sources; the full table from Roll20's 5e compendium).
 */
export type Difficulty = 'Low' | 'Moderate' | 'High' | 'Beyond High'

/** XP budget per character, index 0 = level 1. [low, moderate, high] */
export const XP_BUDGET: readonly (readonly [number, number, number])[] = [
  [50, 75, 100],
  [100, 150, 200],
  [150, 225, 400],
  [250, 375, 500],
  [500, 750, 1100],
  [600, 1000, 1400],
  [750, 1300, 1700],
  [1000, 1700, 2100],
  [1300, 2000, 2600],
  [1600, 2300, 3100],
  [1900, 2900, 4100],
  [2200, 3700, 4700],
  [2600, 4200, 5400],
  [2900, 4900, 6200],
  [3300, 5400, 7800],
  [3800, 6100, 9800],
  [4500, 7200, 11700],
  [5000, 8700, 14200],
  [5500, 10700, 17200],
  [6400, 13200, 22000],
]

/** Party-wide thresholds for the given character levels. */
export function partyBudget(levels: number[]): { low: number; moderate: number; high: number } {
  const sum = { low: 0, moderate: 0, high: 0 }
  for (const l of levels) {
    const [lo, mo, hi] = XP_BUDGET[Math.min(20, Math.max(1, l)) - 1]
    sum.low += lo
    sum.moderate += mo
    sum.high += hi
  }
  return sum
}

/** Which difficulty the encounter's XP falls into: the lowest category whose budget it fits within. */
export function difficultyOf(totalXp: number, budget: { low: number; moderate: number; high: number }): Difficulty {
  if (totalXp <= budget.low) return 'Low'
  if (totalXp <= budget.moderate) return 'Moderate'
  if (totalXp <= budget.high) return 'High'
  return 'Beyond High'
}

/** XP per challenge rating (0 and fractions included), for custom monsters that only list a CR. */
export const XP_BY_CR: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
}
