/**
 * "Rich, Broke or Dead" (Engaging Data): combine mortality with portfolio survival.
 * Mortality from the CDC 2023 US life table; markets from ERN-style historical cohorts.
 * Mortality and markets are treated as independent.
 */
import { cohortCount, simulateCohort } from "./swr-simulation"
import type { MarketHistory, SimOptions } from "./fire-types"

export interface LifeTable {
  source: string
  year: number
  total: number[]
  male: number[]
  female: number[]
}

export type LifeTableSex = "total" | "male" | "female"

export interface RbdRow {
  age: number
  dead: number
  broke: number
  /** Alive, money left but below the starting (real) portfolio. */
  below: number
  /** Alive with at least the starting (real) portfolio. */
  above: number
}

/** Probability of still being alive `years` after `age`, given alive at `age`. */
export function survival(qx: number[], age: number, years: number): number {
  let s = 1
  for (let y = 0; y < years; y++) s *= 1 - qx[Math.min(qx.length - 1, Math.floor(age) + y)]
  return s
}

const MAX_AGE = 100

export function richBrokeDead(
  h: MarketHistory,
  opts: SimOptions,
  wr: number,
  retireAge: number,
  qx: number[],
): RbdRow[] {
  const years = Math.max(1, Math.min(MAX_AGE - Math.floor(retireAge), Math.floor(opts.horizonMonths / 12)))
  const months = years * 12
  const count = cohortCount(h, months)
  if (count === 0) return []
  const broke = new Array(years + 1).fill(0)
  const below = new Array(years + 1).fill(0)
  for (let s = 0; s < count; s++) {
    const path = simulateCohort(h, s, wr, { ...opts, horizonMonths: months })
    for (let y = 0; y <= years; y++) {
      const v = path[y * 12]
      if (v <= 0) broke[y]++
      else if (v < 1) below[y]++
    }
  }
  return Array.from({ length: years + 1 }, (_, y) => {
    const alive = survival(qx, retireAge, y)
    const pb = broke[y] / count
    const pbelow = below[y] / count
    return {
      age: Math.floor(retireAge) + y,
      dead: 1 - alive,
      broke: alive * pb,
      below: alive * pbelow,
      above: alive * (1 - pb - pbelow),
    }
  })
}
