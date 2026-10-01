import type { MarketInflation } from "./plan-types"

const PERCENT = 100

/** FRED series: 5- and 10-year breakevens, the 5y5y forward, and 20-/30-year Treasury and TIPS yields. */
export const SERIES = ["T5YIE", "T5YIFR", "T10YIE", "DGS20", "DFII20", "DGS30", "DFII30"] as const
export type Series = (typeof SERIES)[number]

/** The latest numeric value (percent) and its date in a FRED CSV ("DATE,VALUE" rows; "." for missing days). */
export function latestFromCsv(csv: string): { date: string; value: number } | null {
  const rows = csv.trim().split("\n").slice(1).map((line) => line.split(","))
  for (let i = rows.length - 1; i >= 0; i--) {
    const [date, raw] = rows[i]
    const value = Number(raw)
    if (date && raw && raw !== "." && Number.isFinite(value)) return { date, value }
  }
  return null
}

/** Breakevens from the series' latest values (percent → decimal). */
export function toMarketInflation(v: Record<Series, { date: string; value: number }>): MarketInflation {
  const asOf = SERIES.map((s) => v[s].date).sort().at(-1)!
  return {
    asOf,
    y5: v.T5YIE.value / PERCENT,
    y5y5: v.T5YIFR.value / PERCENT,
    y10: v.T10YIE.value / PERCENT,
    y20: (v.DGS20.value - v.DFII20.value) / PERCENT,
    y30: (v.DGS30.value - v.DFII30.value) / PERCENT,
  }
}

