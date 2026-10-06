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
    for (const c of cohorts) {
      if (!inSlice(c, slice)) continue
      count++
      byOutcome[bucketOf(c, y)]++
    }
    return { key: String(i), slice, count, byOutcome }
  })
}

/** Groups in the accounts-vs-net-worth chart (tenths of the trials, by ending net worth). */
export const COMPOSITION_GROUPS = 10

export interface CompositionGroup {
  /** "Bottom 10%", "10–20%", …, "Top 10%" of trials by ending net worth. */
  label: string
  /** Averages over the group, today's dollars. */
  accounts: number
  /** Home and other property, net of debts (never below zero here; debts beyond property show as a lower net worth). */
  property: number
  netWorth: number
  /** Accounts as a share of net worth (null when net worth isn't positive). */
  accountsShare: number | null
  count: number
  ranOut: number
}

const groupLabel = (i: number, n: number) => {
  const step = 100 / n
  if (i === 0) return `Bottom ${Math.round(step)}%`
  if (i === n - 1) return `Top ${Math.round(step)}%`
  return `${Math.round(i * step)}–${Math.round((i + 1) * step)}%`
}

/**
 * What the endings are made of: trials sorted by ending net worth and cut into equal groups, each with its average
 * money in accounts and average home and other property, so "rich but out of money" endings show for what they are.
 */
export function endingComposition(cohorts: CohortResult[], groups = COMPOSITION_GROUPS): CompositionGroup[] {
  const sorted = [...cohorts].sort((a, b) => endingValue(a) - endingValue(b))
  const n = Math.min(groups, sorted.length)
  return Array.from({ length: n }, (_, i) => {
    const members = sorted.slice(Math.floor((i * sorted.length) / n), Math.floor(((i + 1) * sorted.length) / n))
    const avg = (f: (c: CohortResult) => number) => members.reduce((s, c) => s + f(c), 0) / Math.max(1, members.length)
    const accounts = avg((c) => endingValue(c, "invested"))
    const netWorth = avg((c) => endingValue(c))
    return {
      label: groupLabel(i, n),
      accounts,
      property: Math.max(0, netWorth - accounts),
      netWorth,
      accountsShare: netWorth > 0 ? accounts / netWorth : null,
      count: members.length,
      ranOut: members.filter((c) => c.depletedAge !== null).length,
    }
  })
}
