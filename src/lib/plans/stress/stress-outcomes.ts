import type { CohortResult } from "./stress-test"

/** How many years of spending count as a real cushion, and how close to the end "almost" means. */
export const CUSHION_YEARS = 5
export const CLOSE_YEARS = 5

export type OutcomeKey = "surplus" | "steady" | "justMadeIt" | "almostSurvived" | "catastrophic"

export interface OutcomeBucket {
  key: OutcomeKey
  label: string
  /** The rule, in this plan's own numbers. */
  rule: string
  count: number
  share: number
  /** History years that landed here, earliest first. */
  years: number[]
}

export interface OutcomeYardsticks {
  /** What you have today (net worth or invested, today's dollars). */
  startValue: number
  /** A year of spending at the plan's end, today's dollars. */
  yearlySpending: number
  /** Age the plan ends at. */
  endAge: number
  measure: "netWorth" | "invested"
}

const fmt = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`)

/** Which bucket one historical period falls in. */
function bucketOf(c: CohortResult, y: OutcomeYardsticks): OutcomeKey {
  if (c.depletedAge !== null) return c.depletedAge >= y.endAge - CLOSE_YEARS ? "almostSurvived" : "catastrophic"
  const end = (y.measure === "netWorth" ? c.netWorth : c.invested).at(-1) ?? 0
  if (end > y.startValue) return "surplus"
  return end >= y.yearlySpending * CUSHION_YEARS ? "steady" : "justMadeIt"
}

/**
 * Every historical period sorted into five outcomes, measured against this plan: did the money last, and if so
 * with more than you have today, a cushion of years of spending, or barely; if not, near the end or well before it.
 */
export function outcomeBuckets(cohorts: CohortResult[], y: OutcomeYardsticks): OutcomeBucket[] {
  const what = y.measure === "netWorth" ? "net worth" : "invested money"
  const cushion = y.yearlySpending * CUSHION_YEARS
  const rules: Record<OutcomeKey, { label: string; rule: string }> = {
    surplus: { label: "Surplus", rule: `Lasted and ended with more ${what} than today's ${fmt(y.startValue)}` },
    steady: {
      label: "Steady",
      rule: cushion > 0 ? `Lasted, ending with ${fmt(cushion)}–${fmt(y.startValue)} (at least ${CUSHION_YEARS} years of spending)` : `Lasted, ending with up to ${fmt(y.startValue)}`,
    },
    justMadeIt: {
      label: "Just made it",
      rule: cushion > 0 ? `Lasted, but with less than ${CUSHION_YEARS} years of spending (${fmt(cushion)}) left` : "Lasted with almost nothing left (this plan has no spending to measure a cushion by)",
    },
    almostSurvived: { label: "Almost survived", rule: `Ran out in the last ${CLOSE_YEARS} years, at ${y.endAge - CLOSE_YEARS} or later` },
    catastrophic: { label: "Catastrophic", rule: `Ran out before ${y.endAge - CLOSE_YEARS}` },
  }
  const order: OutcomeKey[] = ["surplus", "steady", "justMadeIt", "almostSurvived", "catastrophic"]
  const byKey = new Map<OutcomeKey, number[]>(order.map((k) => [k, []]))
  for (const c of cohorts) byKey.get(bucketOf(c, y))!.push(c.year)
  return order.map((key) => {
    const years = [...byKey.get(key)!].sort((a, b) => a - b)
    return { key, ...rules[key], count: years.length, share: cohorts.length ? years.length / cohorts.length : 0, years }
  })
}
