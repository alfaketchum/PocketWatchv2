import { bucketOf, type OutcomeKey, type OutcomeYardsticks } from "./stress-outcomes"
import { percentile, type CohortResult } from "./stress-test"

/** Bars for the trials that lasted, in the ending net worth histogram. */
export const HISTOGRAM_BINS = 20
/** The top bin is open-ended from this percentile up, so a few huge endings don't squash the rest. */
const TOP_PERCENTILE = 0.97

/**
 * One bar: every trial that ran out (their ending is mostly the same home equity, so a range says nothing), or the
 * trials that lasted and ended in [from, to).
 */
export type HistogramSlice = { kind: "ranOut" } | { kind: "range"; measure: EndingMeasure; from: number; to: number }

/** What a trial's ending is measured on: everything you own, or only the money in your accounts. */
export type EndingMeasure = "netWorth" | "invested"

export interface HistogramBin {
  key: string
  slice: HistogramSlice
  count: number
  /** Trials in this bar by outcome. */
  byOutcome: Record<OutcomeKey, number>
  /** Totals over the bar's trials at the end, today's dollars: money in accounts, and home and other property net of debts (neither below zero). */
  accounts: number
  property: number
}

const emptyOutcomes = (): Record<OutcomeKey, number> => ({ surplus: 0, steady: 0, justMadeIt: 0, soldHome: 0, almostSurvived: 0, catastrophic: 0 })

/** A trial's ending net worth or money in accounts (today's dollars). */
export const endingValue = (c: CohortResult, measure: EndingMeasure = "netWorth"): number => c[measure].at(-1) ?? 0

/** Whether a trial belongs in a bar. */
export function inSlice(c: CohortResult, s: HistogramSlice): boolean {
  if (s.kind === "ranOut") return c.depletedAge !== null
  const end = endingValue(c, s.measure)
  return c.depletedAge === null && end >= s.from && end < s.to
}

export const sameSlice = (a: HistogramSlice, b: HistogramSlice) =>
  a.kind === b.kind && (a.kind === "ranOut" || (b.kind === "range" && a.measure === b.measure && a.from === b.from && a.to === b.to))

/** Equal-width ranges from the lowest ending to the 97th percentile of `ends`, the last one open-ended. */
function ranges(ends: number[], bins: number, measure: EndingMeasure): HistogramSlice[] {
  if (ends.length === 0) return []
  const low = Math.min(...ends)
  const high = Math.max(percentile(ends, TOP_PERCENTILE), low + 1)
  const width = (high - low) / bins
  return Array.from({ length: bins }, (_, i) => ({ kind: "range" as const, measure, from: i === 0 ? -Infinity : low + i * width, to: i === bins - 1 ? Infinity : low + (i + 1) * width }))
}

/** The histogram: a "ran out" bar when any did, then the endings of the trials that lasted, each with its outcome mix. */
export function histogram(cohorts: CohortResult[], y: OutcomeYardsticks, measure: EndingMeasure, bins = HISTOGRAM_BINS): HistogramBin[] {
  const lasted = cohorts.filter((c) => c.depletedAge === null)
  const ends = lasted.map((c) => endingValue(c, measure))
  const slices: HistogramSlice[] = [...(lasted.length < cohorts.length ? [{ kind: "ranOut" as const }] : []), ...ranges(ends, bins, measure)]
  return slices.map((slice, i) => {
    const byOutcome = emptyOutcomes()
    let count = 0
    let accounts = 0
    let property = 0
    for (const c of cohorts) {
      if (!inSlice(c, slice)) continue
      count++
      byOutcome[bucketOf(c, y)]++
      const invested = Math.max(0, endingValue(c, "invested"))
      accounts += invested
      property += Math.max(0, endingValue(c) - invested)
    }
    return { key: String(i), slice, count, byOutcome, accounts, property }
  })
}
