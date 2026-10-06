import { percentile, type CohortResult } from "./stress-test"

/** How many years of spending count as a real cushion, and how close to the end "almost" means. */
export const CUSHION_YEARS = 5
export const CLOSE_YEARS = 5

export type OutcomeKey = "surplus" | "steady" | "justMadeIt" | "soldHome" | "outOfCash" | "almostSurvived" | "catastrophic"

export interface OutcomeBucket {
  key: OutcomeKey
  label: string
  /** The rule, in this plan's own numbers. */
  rule: string
  count: number
  share: number
  /** History years that landed here, earliest first. */
  years: number[]
  /** Ran-out buckets: the typical home equity still left when the money ran out. */
  note?: string
  /** Ran-out buckets with home sales: how many sold a home first, and how many ran out before a planned sale. */
  salesNote?: string
  /** Buckets that lasted: the typical (median) lowest point along the way. */
  lowPoint?: { years: number; age: number }
  /** The typical (median) area under the danger line, in danger-years. */
  dangerArea?: number
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

/** Whether a trial that ran out had already sold a home (by the plan or the stress test) by then. */
const soldBefore = (c: CohortResult) => c.depletedAge !== null && (c.homeSales ?? []).some((s) => s.age <= c.depletedAge!)

/** Which bucket one historical period or trial falls in. */
export function bucketOf(c: CohortResult, y: OutcomeYardsticks): OutcomeKey {
  if (c.depletedAge !== null) {
    // Measured on net worth, running out with a home not yet sold isn't going broke: it can still be sold. Running out
    // after a sale is, since the home was already spent.
    if (y.measure === "netWorth" && (c.lowestWorthAfterRunOut ?? 0) > 0 && !soldBefore(c)) return "outOfCash"
    return c.depletedAge >= y.endAge - CLOSE_YEARS ? "almostSurvived" : "catastrophic"
  }
  if (c.soldHome) return "soldHome"
  const end = (y.measure === "netWorth" ? c.netWorth : c.invested).at(-1) ?? 0
  if (end > y.startValue) return "surplus"
  return end >= y.yearlySpending * CUSHION_YEARS ? "steady" : "justMadeIt"
}

/** For periods that ran out: the typical (median) home equity left then, when there is any. */
function equityNote(members: CohortResult[]): string | null {
  const failed = members.filter((c) => c.depletedAge !== null)
  if (failed.length === 0) return null
  const typical = percentile(failed.map((c) => c.equityAtDepletion ?? 0), 0.5)
  return typical >= 1 ? `Typically ${fmt(typical)} of home equity still left when it ran out` : null
}

/** For periods that ran out: how many had already sold a home, and how many ran out before a sale the plan makes. */
function salesNote(members: CohortResult[]): string | null {
  const failed = members.filter((c) => c.depletedAge !== null && c.homeSales)
  const first = failed.filter((c) => c.homeSales!.some((s) => s.age <= c.depletedAge!)).length
  const before = failed.filter((c) => c.homeSales!.some((s) => s.planned && s.age > c.depletedAge!)).length
  const parts = [first > 0 ? `${first} ran out after selling a home` : "", before > 0 ? `${before} ran out before the plan's home sale` : ""]
  return parts.filter(Boolean).join(" · ") || null
}

/** The middle member's lowest point (so the age goes with it), for periods that lasted. */
function typicalLow(members: CohortResult[]): OutcomeBucket["lowPoint"] {
  const lows = members.flatMap((c) => (c.depletedAge === null && c.lowPoint ? [c.lowPoint] : [])).sort((a, b) => a.years - b.years)
  return lows.length > 0 ? lows[Math.floor((lows.length - 1) / 2)] : undefined
}

/** Closeness to running out, typical for the bucket: its lowest point and its area under the danger line. */
function closeness(members: CohortResult[]): Pick<OutcomeBucket, "lowPoint" | "dangerArea"> {
  if (members.length === 0) return {}
  const low = typicalLow(members)
  return { ...(low ? { lowPoint: low } : {}), dangerArea: percentile(members.map((c) => c.dangerArea ?? 0), 0.5) }
}

/**
 * Every historical period sorted into outcomes, measured against this plan: did the money last, and if so with more
 * than you have today, a cushion of years of spending, barely, or only by selling a home; if not, near the end or well
 * before it. Measured on net worth, running out with net worth still above $0 is its own outcome, out of cash.
 */
export function outcomeBuckets(cohorts: CohortResult[], y: OutcomeYardsticks): OutcomeBucket[] {
  const worth = y.measure === "netWorth"
  const what = worth ? "net worth" : "money in your accounts"
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
    soldHome: { label: "Lasted by selling the home", rule: "Lasted only because a home's backup plan sold it when the money ran low" },
    outOfCash: { label: "Out of cash", rule: "Your accounts ran out before any home was sold, and net worth never hit $0: the home could still be sold" },
    almostSurvived: {
      label: "Almost survived",
      rule: worth ? `Ran out at ${y.endAge - CLOSE_YEARS} or later, after selling a home or with net worth at $0` : `Ran out in the last ${CLOSE_YEARS} years, at ${y.endAge - CLOSE_YEARS} or later`,
    },
    catastrophic: { label: "Catastrophic", rule: worth ? `Ran out before ${y.endAge - CLOSE_YEARS}, after selling a home or with net worth at $0` : `Ran out before ${y.endAge - CLOSE_YEARS}` },
  }
  const order: OutcomeKey[] = ["surplus", "steady", "justMadeIt", "soldHome", "outOfCash", "almostSurvived", "catastrophic"]
  const byKey = new Map<OutcomeKey, CohortResult[]>(order.map((k) => [k, []]))
  for (const c of cohorts) byKey.get(bucketOf(c, y))!.push(c)
  return order.map((key) => {
    const members = byKey.get(key)!
    const years = members.map((c) => c.year).sort((a, b) => a - b)
    const note = equityNote(members)
    const sales = salesNote(members)
    return {
      key,
      ...rules[key],
      count: years.length,
      share: cohorts.length ? years.length / cohorts.length : 0,
      years,
      ...(note ? { note } : {}),
      ...(sales ? { salesNote: sales } : {}),
      ...closeness(members),
    }
  })
}
