/**
 * Stress test: the whole plan re-run through every historical market since 1871 (Early Retirement Now style).
 * Each cohort lines a start year of history up with the plan's start or its retirement and replays the years
 * that follow, with each account earning what its mix earned then (see stress-mix.ts). Only cohorts with
 * history for every year from that anchor to the plan's end count.
 */

import { simulatePlan } from "../engine/simulate"
import { deflator } from "../plan-dollars"
import { inflationOf, rateAt } from "../plan-inflation"
import { ageAtStart, resolveTiming, timingContext } from "../plan-timing"
import type { PlanDocument } from "../plan-types"
import type { AnnualHistory } from "./stress-history"
import { yearReturn } from "./stress-mix"

/** History lines up with the plan's first year, or with the retirement year. */
export type StressAlign = "start" | "retirement"

/** A year counts as having run out of money when spending this much (or more) goes unfunded. */
const SHORTFALL = 0.5

export interface CohortResult {
  /** History year lined up with the anchor. */
  year: number
  cape: number | null
  /** Age the money ran out, or null when it lasted. */
  depletedAge: number | null
  /** Year-end values by plan year, today's dollars. */
  netWorth: number[]
  invested: number[]
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

/** One cohort: the plan with history position `start` lined up with plan year `anchor`. */
export function runCohort(doc: PlanDocument, annual: AnnualHistory, start: number, anchor: number): CohortResult {
  const inflation = inflationOf(doc.settings, timingContext(doc).length)
  const projection = simulatePlan(doc, {
    returnFor: (account, index) => {
      const h = start + index - anchor
      // Before the record begins (only when lining up with retirement): the account's assumed return.
      if (h < 0) return account.returnRate
      return yearReturn(account, { stockReal: annual.stocks[h], bondReal: annual.bonds[h], stockLogMean: annual.stockLogMean }, rateAt(inflation, index), doc.settings.inflation)
    },
  })
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const failed = projection.rows.find((r) => r.shortfall > SHORTFALL)
  const real = (value: number, index: number) => value / deflator(inflation, index, "balance")
  return {
    year: annual.years[start],
    cape: annual.cape[start],
    depletedAge: failed ? age0 + failed.index : null,
    netWorth: projection.rows.map((r) => real(r.netWorth, r.index)),
    invested: projection.rows.map((r) => real(r.accountsTotal, r.index)),
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
  medianEnd: number
  p10End: number
  /** Earliest run-out, or the lowest ending net worth when every cohort lasts. */
  worst: CohortResult | null
  /** Per plan year: net worth / invested percentiles (BANDS order). */
  netWorthBands: number[][]
  investedBands: number[][]
}

/** Cohorts at or above `capeMin` (all of them when null) summarized. */
export function summarize(all: CohortResult[], capeMin: number | null): StressSummary {
  const cohorts = capeMin === null ? all : all.filter((c) => c.cape !== null && c.cape >= capeMin)
  const ends = cohorts.map((c) => c.netWorth.at(-1) ?? 0)
  const failures = cohorts.filter((c) => c.depletedAge !== null).sort((a, b) => (a.depletedAge ?? 0) - (b.depletedAge ?? 0))
  const lowest = [...cohorts].sort((a, b) => (a.netWorth.at(-1) ?? 0) - (b.netWorth.at(-1) ?? 0))[0] ?? null
  const length = cohorts[0]?.netWorth.length ?? 0
  const bands = (key: "netWorth" | "invested") =>
    Array.from({ length }, (_, i) => BANDS.map((p) => percentile(cohorts.map((c) => c[key][i]), p)))
  return {
    cohorts,
    successRate: cohorts.length > 0 ? 1 - failures.length / cohorts.length : 0,
    medianEnd: percentile(ends, 0.5),
    p10End: percentile(ends, 0.1),
    worst: failures[0] ?? lowest,
    netWorthBands: bands("netWorth"),
    investedBands: bands("invested"),
  }
}
