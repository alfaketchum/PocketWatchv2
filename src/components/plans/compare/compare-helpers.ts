import type { ChartMode, ChartRow, Series } from "../results/use-chart-series"

/** Which way is better for each view's total, for coloring the difference; null = neither (cash flow balances). */
export const BETTER: Record<ChartMode, "higher" | "lower" | null> = {
  networth: "higher",
  accounts: "higher",
  income: "higher",
  expenses: "lower",
  taxes: "lower",
  debt: "lower",
  cashflow: null,
}

/** Both plans' bands, A's order first: a band only one plan has (B's home) still lines up in both charts. */
export function unionSeries(a: Series[], b: Series[]): Series[] {
  const seen = new Set(a.map((s) => s.key))
  return [...a, ...b.filter((s) => !seen.has(s.key))]
}

/** A row with every band filled in (0 where a plan has none), so hover cards and sums never read a missing key. */
function filled(row: ChartRow, keys: string[]): ChartRow {
  const out: ChartRow = { ...row }
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}

/**
 * Both plans on one run of calendar years, so year N sits in the same slot in each chart. A year one plan doesn't
 * reach is an empty bar at the age that plan's people would be.
 */
export function alignYears(a: ChartRow[], b: ChartRow[], keys: string[]): { a: ChartRow[]; b: ChartRow[]; years: number[] } {
  const years = [...new Set([...a, ...b].map((r) => r.year))].sort((x, y) => x - y)
  const pad = (rows: ChartRow[]) => {
    const byYear = new Map(rows.map((r) => [r.year, r]))
    const ageOffset = rows[0] ? rows[0].age - rows[0].year : 0
    return years.map((year) => filled(byYear.get(year) ?? ({ year, age: year + ageOffset, netWorth: 0 } as ChartRow), keys))
  }
  return { a: pad(a), b: pad(b), years }
}

/** A row's total: the sum of its bands (net worth with debt below zero; money in and out net to ~0). */
export function rowTotal(row: ChartRow | undefined, keys: string[]): number {
  return row ? keys.reduce((t, k) => t + (row[k] ?? 0), 0) : 0
}

/**
 * B minus A for each band and the total, per year of the aligned rows. A year only one plan runs is left empty
 * (`inBoth` 0): comparing against a plan that has ended would read as a gain or loss of everything.
 */
export function diffRows(a: ChartRow[], b: ChartRow[], keys: string[], aYears: Set<number>, bYears: Set<number>): ChartRow[] {
  return a.map((ra, i) => {
    const rb = b[i]
    if (!rb || !aYears.has(ra.year) || !bYears.has(ra.year)) return { year: ra.year, age: ra.age, inBoth: 0 }
    const deltas = Object.fromEntries(keys.map((k) => [k, (rb[k] ?? 0) - (ra[k] ?? 0)]))
    return { year: ra.year, age: ra.age, inBoth: 1, total: rowTotal(rb, keys) - rowTotal(ra, keys), ...deltas }
  })
}

/** Whether a difference is good news (+1), bad news (−1) or neutral (0) for this view. */
export function tone(mode: ChartMode, delta: number): -1 | 0 | 1 {
  const better = BETTER[mode]
  if (!better || Math.abs(delta) < 0.5) return 0
  return (delta > 0) === (better === "higher") ? 1 : -1
}
