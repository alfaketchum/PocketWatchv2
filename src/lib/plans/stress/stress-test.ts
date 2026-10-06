/**
 * Stress test: the whole plan re-run through historical markets since 1871. In the plain replay (Early Retirement
 * Now style) each cohort lines a start year of history up with the plan's start or its retirement and replays the
 * years that follow; only cohorts with history for every year from that anchor to the plan's end count. Simulated
 * trials (stress-sampling.ts) stitch history's years together differently, from the plan's first year. Either way
 * each account earns what its mix earned in that year (see stress-mix.ts).
 *
 * Inflation is the plan's own by default. The historical returns already have each year's actual inflation
 * taken out, so for anything that rises with prices the rate cancels. With `inflation: "history"` each run
 * also lives through that period's actual inflation (from 1913, when official CPI starts), which moves
 * what stays fixed in dollars: pensions without raises, loan payments, fixed-growth lines, unindexed tax lines.
 */

import { simulatePlan } from "../engine/simulate"
import { deflator } from "../plan-dollars"
import { expandPlan } from "../plan-expand"
import { homeEquity, SHORTFALL } from "../plan-home-fallback"
import { inflationOf, inflationPath, rateAt, type Inflation } from "../plan-inflation"
import { ageAtStart, resolveTiming, timingContext } from "../plan-timing"
import type { PlanDocument } from "../plan-types"
import type { YearRow } from "../plan-row-types"
import { CPI_RELIABLE_FROM, type AnnualHistory } from "./stress-history"
import { closeCall, type CloseCall } from "./stress-close-calls"
import { equityYearReturn, yearReturn } from "./stress-mix"
import { trialPaths, type SamplingOptions } from "./stress-sampling"

/** History lines up with the plan's first year, or with the retirement year. */
export type StressAlign = "start" | "retirement"

/** The plan's own inflation, or what actually happened in each historical period. */
export type StressInflation = "plan" | "history"

/** Years of a period's inflation summarized in the worst-periods table. */
const INFLATION_SUMMARY_YEARS = 10

export interface CohortResult {
  /** History year lined up with the anchor (a simulated trial's first year). */
  year: number
  /** Simulated trials: the trial's number (from 0). */
  trial?: number
  /** The history year each plan year lived through (null: before the record, assumed returns). */
  sequence: (number | null)[]
  cape: number | null
  /** Average yearly inflation over the first years from the anchor (null before official CPI). */
  avgInflation: number | null
  /** Age the money ran out, or null when it lasted. */
  depletedAge: number | null
  /** A home's backup plan sold it to keep the money going. */
  soldHome?: boolean
  /** When it ran out: home equity left, today's dollars. */
  equityAtDepletion?: number
  /** Lowest point and area under the danger line (stress-close-calls). */
  lowPoint?: CloseCall["lowPoint"]
  dangerArea?: number
  cushion?: CloseCall["cushion"]
  /** With a spending rule: the lowest the rule took flexible spending, as a share of plan (1 = never cut). */
  lowestSpending?: number
  /** Year-end values by plan year, today's dollars. */
  netWorth: number[]
  invested: number[]
  /** Each year's withdrawals as a share of the accounts at the start of the year. */
  withdrawalRate: number[]
}

/** Plan index of the anchor (0, or the retirement year), or null when the plan has no retirement inside it. */
export function anchorIndex(doc: PlanDocument, align: StressAlign): number | null {
  if (align === "start") return 0
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  const ctx = timingContext(doc)
  const index = retirement ? resolveTiming(retirement.timing, ctx) : null
  return index !== null && index >= 0 && index < ctx.length ? index : null
}

/** History positions (indexes into `annual.years`) whose cohort is complete for this plan and anchor. */
export function cohortStarts(doc: PlanDocument, annual: AnnualHistory, anchor: number): number[] {
  const yearsAfter = timingContext(doc).length - anchor
  const last = annual.years.length - yearsAfter
  return Array.from({ length: Math.max(0, last + 1) }, (_, i) => i)
}

/** The path of a historical cohort: plan year `t` lives through history position `start + t − anchor` (negative: before the record). */
export function cohortPath(doc: PlanDocument, start: number, anchor: number): number[] {
  return Array.from({ length: timingContext(doc).length }, (_, t) => start + t - anchor)
}

/**
 * Every trial's path for this plan: each complete historical start year lined up with `anchor`, or simulated trials
 * (stress-sampling.ts), which always start from the plan's first year.
 */
export function stressPaths(doc: PlanDocument, annual: AnnualHistory, anchor: number, sampling: SamplingOptions): number[][] {
  if (sampling.method === "history") return cohortStarts(doc, annual, anchor).map((start) => cohortPath(doc, start, anchor))
  return trialPaths(annual.years.length, timingContext(doc).length, sampling)
}

/** Actual inflation in history position `h`, or null outside the record or before official CPI. */
function historicalRate(annual: AnnualHistory, h: number): number | null {
  if (h < 0 || h >= annual.years.length || annual.years[h] < CPI_RELIABLE_FROM) return null
  return annual.inflation[h] ?? null
}

/**
 * A path's inflation: the plan's own, or history's actual rate for each year it covers (the plan's own before
 * official CPI and before the record begins).
 */
export function pathInflation(doc: PlanDocument, annual: AnnualHistory, path: number[], mode: StressInflation): Inflation {
  const length = timingContext(doc).length
  const plan = inflationOf(doc.settings, length)
  if (mode === "plan") return plan
  const rates = Array.from({ length }, (_, t) => historicalRate(annual, path[t] ?? -1) ?? rateAt(plan, t))
  return inflationPath(rates, rateAt(plan, length))
}

/** A historical cohort's inflation (see `pathInflation`). */
export function cohortInflation(doc: PlanDocument, annual: AnnualHistory, start: number, anchor: number, mode: StressInflation): Inflation {
  return pathInflation(doc, annual, cohortPath(doc, start, anchor), mode)
}

/**
 * Annualized inflation over the path's first years from the anchor (running on through history past a short plan's
 * end), or null when any of them predates official CPI.
 */
function averageInflation(annual: AnnualHistory, path: number[], anchor: number): number | null {
  const last = path.length - 1
  let level = 1
  for (let t = anchor; t < anchor + INFLATION_SUMMARY_YEARS; t++) {
    const rate = historicalRate(annual, t <= last ? path[t] : path[last] + t - last)
    if (rate === null) return null
    level *= 1 + rate
  }
  return Math.pow(level, 1 / INFLATION_SUMMARY_YEARS) - 1
}

/** Withdrawal rates shown top out here: in a trial's last years before running dry the share heads to infinity. */
export const MAX_WITHDRAWAL_RATE = 1

/**
 * Each year's withdrawals as a share of what the accounts held at the start of that year, capped at 100%; a year
 * the accounts couldn't cover counts as 100%.
 */
export function withdrawalRates(doc: PlanDocument, rows: YearRow[]): number[] {
  let before = doc.accounts.reduce((sum, a) => sum + a.balance, 0)
  return rows.map((r) => {
    const share = before > 0 ? r.withdrawals / before : 0
    const rate = r.shortfall > SHORTFALL ? MAX_WITHDRAWAL_RATE : Math.min(MAX_WITHDRAWAL_RATE, share)
    before = r.accountsTotal
    return rate
  })
}

/** One cohort: the plan with history position `start` lined up with plan year `anchor`. */
export function runCohort(doc: PlanDocument, annual: AnnualHistory, start: number, anchor: number, mode: StressInflation = "plan"): CohortResult {
  return runPath(doc, annual, cohortPath(doc, start, anchor), anchor, mode)
}

/**
 * One trial: plan year `t` earns what history position `path[t]` earned (assumed returns where it's negative, before
 * the record). `anchor` is the plan year the trial is labelled by (its start year, CAPE and inflation summary).
 */
export function runPath(doc: PlanDocument, annual: AnnualHistory, path: number[], anchor: number, mode: StressInflation = "plan", trial?: number): CohortResult {
  const inflation = pathInflation(doc, annual, path, mode)
  const at = (index: number) => path[index] ?? -1
  const market = (index: number) => {
    const h = at(index)
    return h < 0 ? null : { stockReal: annual.stocks[h], bondReal: annual.bonds[h], stockLogMean: annual.stockLogMean }
  }
  const projection = simulatePlan(doc, {
    inflation,
    homeFallbacks: true,
    returnFor: (account, index) => {
      const year = market(index)
      return year ? yearReturn(account, year, rateAt(inflation, index), doc.settings.inflation) : account.returnRate
    },
    equityReturnFor: (income, index) => {
      const year = market(index)
      return year ? equityYearReturn(income.growth, year, rateAt(inflation, index), doc.settings.inflation) : (income.growth ?? rateAt(inflation, index))
    },
    // A CAPE spending rule sees each year's actual valuation (none before the record: spend as planned).
    capeFor: (index) => {
      const h = at(index)
      return h < 0 ? null : (annual.cape[h] ?? null)
    },
  })
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const failed = projection.rows.find((r) => r.shortfall > SHORTFALL)
  const real = (value: number, index: number) => value / deflator(inflation, index, "balance")
  const first = at(anchor)
  return {
    year: annual.years[first],
    ...(trial !== undefined ? { trial } : {}),
    sequence: path.map((h) => (h < 0 ? null : annual.years[h])),
    cape: annual.cape[first],
    avgInflation: averageInflation(annual, path, anchor),
    depletedAge: failed ? age0 + failed.index : null,
    soldHome: (projection.homeSales?.length ?? 0) > 0,
    equityAtDepletion: failed ? real(homeEquity(expandPlan(doc, inflation), failed), failed.index) : 0,
    ...closeCall(projection.rows, age0),
    ...(doc.settings.spendingRule ? { lowestSpending: Math.min(1, ...projection.rows.map((r) => r.spendingFactor)) } : {}),
    netWorth: projection.rows.map((r) => real(r.netWorth, r.index)),
    invested: projection.rows.map((r) => real(r.accountsTotal, r.index)),
    withdrawalRate: withdrawalRates(doc, projection.rows),
  }
}

/** The p-th percentile (0–1) of `values`, linearly interpolated. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export const BANDS = [0.1, 0.25, 0.5, 0.75, 0.9] as const

export interface StressSummary {
  cohorts: CohortResult[]
  /** Share of cohorts in which the money lasts to the end of the plan. */
  successRate: number
  /** Ending net worth (home and property included): median and 10th percentile, today's dollars. */
  medianEnd: number
  p10End: number
  /** Money left in the accounts at the end: median and 10th percentile, today's dollars. */
  medianEndInvested: number
  p10EndInvested: number
  /** Earliest run-out, or the lowest ending net worth when every cohort lasts. */
  worst: CohortResult | null
  /** Per plan year: net worth / invested / withdrawal-rate percentiles (BANDS order). */
  netWorthBands: number[][]
  investedBands: number[][]
  withdrawalBands: number[][]
  /** With a spending rule: how low it took spending (share of plan) in the median and the worst 10% of periods. */
  spendingDip: { median: number; worst10: number } | null
}

function spendingDip(cohorts: CohortResult[]): StressSummary["spendingDip"] {
  const lows = cohorts.flatMap((c) => (c.lowestSpending === undefined ? [] : [c.lowestSpending]))
  return lows.length > 0 ? { median: percentile(lows, 0.5), worst10: percentile(lows, 0.1) } : null
}

/** Cohorts at or above `capeMin` (all of them when null), and passing `keep` when given, summarized. */
export function summarize(all: CohortResult[], capeMin: number | null, keep?: (c: CohortResult) => boolean): StressSummary {
  const cohorts = all.filter((c) => (capeMin === null || (c.cape !== null && c.cape >= capeMin)) && (!keep || keep(c)))
  const ends = cohorts.map((c) => c.netWorth.at(-1) ?? 0)
  const endsInvested = cohorts.map((c) => c.invested.at(-1) ?? 0)
  const failures = cohorts.filter((c) => c.depletedAge !== null).sort((a, b) => (a.depletedAge ?? 0) - (b.depletedAge ?? 0))
  const lowest = [...cohorts].sort((a, b) => (a.netWorth.at(-1) ?? 0) - (b.netWorth.at(-1) ?? 0))[0] ?? null
  const length = cohorts[0]?.netWorth.length ?? 0
  const bands = (key: "netWorth" | "invested" | "withdrawalRate") =>
    Array.from({ length }, (_, i) => BANDS.map((p) => percentile(cohorts.map((c) => c[key][i]), p)))
  return {
    cohorts,
    successRate: cohorts.length > 0 ? 1 - failures.length / cohorts.length : 0,
    medianEnd: percentile(ends, 0.5),
    p10End: percentile(ends, 0.1),
    medianEndInvested: percentile(endsInvested, 0.5),
    p10EndInvested: percentile(endsInvested, 0.1),
    worst: failures[0] ?? lowest,
    netWorthBands: bands("netWorth"),
    investedBands: bands("invested"),
    withdrawalBands: bands("withdrawalRate"),
    spendingDip: spendingDip(cohorts),
  }
}
