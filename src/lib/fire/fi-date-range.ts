/**
 * Range of FI dates: run the user's saving plan (today's portfolio + monthly contributions)
 * through every historical start month instead of a fixed return, ERN-style.
 * Contributions stop once the target is reached; windfalls land at their month.
 */
import { MAX_PROJECTION_YEARS } from "./fire-constants"
import { equityAt, monthFactor } from "./swr-simulation"
import type { EquityPlan, MarketHistory } from "./fire-types"
import type { Windfall } from "./fire-projection"

export interface AccumulationInput {
  start: number
  annualContribution: number
  target: number
  equity: EquityPlan
  feeAnnual: number
  windfalls: Windfall[]
  /** How many years of value bands to return. */
  bandYears: number
}

export interface ValueBand {
  year: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  cohorts: number
}

export interface FiDateRange {
  /** Years to FI at the 10th/25th/50th/75th/90th percentile of cohorts (10th = fastest). */
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  /** Cohorts that reached FI within the available data (the rest ran out of history). */
  cohorts: number
  bands: ValueBand[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const idx = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * p))
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function windfallAtMonth(windfalls: Windfall[], month: number): number {
  return windfalls.reduce((s, w) => (Math.round(w.yearsFromNow * 12) === month ? s + w.amount : s), 0)
}

/** Month-by-month path for one historical start; stops at `months`. Returns yearly values and months-to-FI. */
function runCohort(h: MarketHistory, s: number, input: AccumulationInput, months: number, bandMonths: number) {
  const feeMonthly = input.feeAnnual / 12
  const monthly = input.annualContribution / 12
  const cash = input.equity.cash ?? 0
  const yearly: number[] = [input.start]
  let value = input.start
  let reachedAt: number | null = value >= input.target ? 0 : null
  for (let t = 0; t < months; t++) {
    const adding = reachedAt === null ? monthly : 0
    value = value * monthFactor(h, s + t, equityAt(input.equity, t), cash, feeMonthly) + adding + windfallAtMonth(input.windfalls, t + 1)
    if (reachedAt === null && value >= input.target) reachedAt = t + 1
    if ((t + 1) % 12 === 0) yearly.push(value)
    if (reachedAt !== null && t + 1 >= bandMonths) break
  }
  return { yearly, reachedAt }
}

export function fiDateRange(h: MarketHistory, input: AccumulationInput): FiDateRange | null {
  const maxMonths = MAX_PROJECTION_YEARS * 12
  const bandMonths = Math.min(maxMonths, Math.max(12, Math.ceil(input.bandYears) * 12))
  const n = h.months.length
  const reached: number[] = []
  const byYear: number[][] = Array.from({ length: bandMonths / 12 + 1 }, () => [])
  for (let s = 0; s < n; s++) {
    const available = Math.min(maxMonths, n - s)
    const { yearly, reachedAt } = runCohort(h, s, input, available, bandMonths)
    if (reachedAt !== null) reached.push(reachedAt / 12)
    yearly.forEach((v, y) => {
      if (y < byYear.length) byYear[y].push(v)
    })
  }
  if (reached.length === 0) return null
  const sorted = [...reached].sort((a, b) => a - b)
  const bands = byYear
    .map((vals, year) => {
      const v = [...vals].sort((a, b) => a - b)
      return { year, p10: percentile(v, 0.1), p25: percentile(v, 0.25), p50: percentile(v, 0.5), p75: percentile(v, 0.75), p90: percentile(v, 0.9), cohorts: v.length }
    })
    .filter((b) => b.cohorts > 0)
  return {
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    cohorts: sorted.length,
    bands,
  }
}
