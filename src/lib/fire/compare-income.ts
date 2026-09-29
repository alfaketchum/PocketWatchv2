/**
 * Income comparisons for FIRE › Compare: your zip's household-income distribution (ACS),
 * pay vs your occupation (ACS median / BLS percentiles), and the "Millionaire Next Door" score.
 */

export interface ZipRow {
  zip: string
  state: string | null
  medianIncome: number | null
  bracketCounts: number[]
  medianHomeValue: number | null
  medianRent: number | null
}

/** ACS B19001 bracket lower bounds; the last bracket is $200,000+. */
export const ACS_BRACKETS = [0, 10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 60_000, 75_000, 100_000, 125_000, 150_000, 200_000]
/** Assumed width of the open-ended top bracket for interpolation (200k–400k). */
const TOP_BRACKET_WIDTH = 200_000

/** Percentile (0–100) of `income` among the zip's households, interpolating linearly within brackets. */
export function zipIncomePercentile(counts: number[], income: number): number | null {
  const total = counts.reduce((s, c) => s + c, 0)
  if (total <= 0) return null
  let below = 0
  for (let i = 0; i < counts.length; i++) {
    const lo = ACS_BRACKETS[i]
    const hi = ACS_BRACKETS[i + 1] ?? lo + TOP_BRACKET_WIDTH
    if (income < hi) {
      const within = Math.max(0, Math.min(1, (income - lo) / (hi - lo)))
      return Math.min(100, ((below + within * counts[i]) / total) * 100)
    }
    below += counts[i]
  }
  return 99.9
}

export type WealthLabel = "PAW" | "AAW" | "UAW"

export interface MillionaireScore {
  /** Stanley & Danko: expected net worth = age × pre-tax household income ÷ 10. */
  expected: number
  ratio: number
  label: WealthLabel
}

/** Prodigious (≥ 2× expected), average, or under (≤ ½ expected) accumulator of wealth. */
export function millionaireNextDoor(age: number, householdIncome: number, netWorth: number): MillionaireScore | null {
  const expected = (age * householdIncome) / 10
  if (expected <= 0) return null
  const ratio = netWorth / expected
  return { expected, ratio, label: ratio >= 2 ? "PAW" : ratio <= 0.5 ? "UAW" : "AAW" }
}

export interface PayPercentiles {
  p10: number | null
  p25: number | null
  p50: number | null
  p75: number | null
  p90: number | null
}

/** Your pay's position: multiple of the median, and an interpolated percentile when bands exist. */
export function payPosition(pay: number, median: number, bands: PayPercentiles | null): { multiple: number; percentile: number | null } {
  const multiple = median > 0 ? pay / median : NaN
  if (!bands) return { multiple, percentile: null }
  const raw: [number, number | null][] = [[10, bands.p10], [25, bands.p25], [50, bands.p50], [75, bands.p75], [90, bands.p90]]
  const pts = raw.filter((p): p is [number, number] => p[1] != null)
  if (pts.length < 2) return { multiple, percentile: null }
  if (pay <= pts[0][1]) return { multiple, percentile: Math.max(1, (pts[0][0] * pay) / pts[0][1]) }
  if (pay >= pts[pts.length - 1][1]) return { multiple, percentile: 95 }
  const i = pts.findIndex(([, v]) => v >= pay)
  const [p0, v0] = pts[i - 1]
  const [p1, v1] = pts[i]
  return { multiple, percentile: p0 + ((pay - v0) / (v1 - v0 || 1)) * (p1 - p0) }
}
