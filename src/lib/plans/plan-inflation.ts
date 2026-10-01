/**
 * Inflation as either one rate for every year or a path of yearly rates (from the bond market's
 * breakeven curve). Everything that grows with inflation goes through `priceIndex`.
 */

import type { MarketInflation, PlanSettings } from "./plan-types"

export interface InflationPath {
  /** Rate for each plan year; years past the end use `tail`. */
  rates: number[]
  tail: number
  /** Price level at the start of each year 0…rates.length (filled by `withLevels`). */
  levels?: number[]
}

/** Precomputes the price level at the start of every year, so `priceIndex` is a lookup. */
function withLevels(path: InflationPath): InflationPath {
  const levels = [1]
  for (const r of path.rates) levels.push(levels[levels.length - 1] * (1 + r))
  return { ...path, levels }
}

export type Inflation = number | InflationPath

/** A path from yearly rates (e.g. history's actual inflation), with `tail` for the years after. */
export function inflationPath(rates: number[], tail: number): InflationPath {
  return withLevels({ rates, tail })
}

/** Plausible bounds for a yearly rate derived from market yields. */
const MIN_RATE = -0.02
const MAX_RATE = 0.1
const clamp = (r: number) => Math.min(MAX_RATE, Math.max(MIN_RATE, r))

/** The rate in year `t` (t < 0 uses the first year's rate). */
export function rateAt(inflation: Inflation, t: number): number {
  if (typeof inflation === "number") return inflation
  const i = Math.floor(t)
  if (i < 0) return inflation.rates[0] ?? inflation.tail
  return i < inflation.rates.length ? inflation.rates[i] : inflation.tail
}

/** Prices at the start of year `t` relative to now: (1 + i)^t, or the product of each year's rate. */
export function priceIndex(inflation: Inflation, t: number): number {
  if (typeof inflation === "number") return Math.pow(1 + inflation, t)
  if (t <= 0) return Math.pow(1 + rateAt(inflation, 0), t)
  const whole = Math.floor(t)
  const levels = inflation.levels
  if (levels && whole < levels.length) return levels[whole] * Math.pow(1 + rateAt(inflation, whole), t - whole)
  let index = levels ? levels[levels.length - 1] : 1
  for (let k = levels ? levels.length - 1 : 0; k < whole; k++) index *= 1 + rateAt(inflation, k)
  return index * Math.pow(1 + rateAt(inflation, whole), t - whole)
}

/** Years past this use the 30-year breakeven. */
const LONG_RUN_FROM = 30

/** The forward rate between two breakevens: what the market expects from year `a` to year `b`. */
function forward(ya: number, a: number, yb: number, b: number): number {
  return Math.pow(Math.pow(1 + yb, b) / Math.pow(1 + ya, a), 1 / (b - a)) - 1
}

/**
 * Year-by-year rates from the breakeven curve: years 1–5 the 5-year breakeven, 6–10 the 5y5y forward,
 * 11–20 and 21–30 the forwards implied by the 10/20/30-year breakevens, and after 30 years the 30-year
 * breakeven itself (a steadier long-run anchor than one decade's forward).
 */
export function marketPath(m: MarketInflation, years: number): InflationPath {
  const f10to20 = clamp(forward(m.y10, 10, m.y20, 20))
  const f20to30 = clamp(forward(m.y20, 20, m.y30, 30))
  const rateFor = (k: number) => (k < 5 ? m.y5 : k < 10 ? m.y5y5 : k < 20 ? f10to20 : f20to30)
  const rates = Array.from({ length: Math.max(0, years) }, (_, k) => (k < LONG_RUN_FROM ? clamp(rateFor(k)) : clamp(m.y30)))
  return withLevels({ rates, tail: clamp(m.y30) })
}

/** Segments of the path for display: "years 1–5: 2.36%", … */
export function marketSegments(m: MarketInflation): { label: string; rate: number }[] {
  const path = marketPath(m, 30)
  return [
    { label: "Years 1–5", rate: path.rates[0] },
    { label: "Years 6–10", rate: path.rates[5] },
    { label: "Years 11–20", rate: path.rates[10] },
    { label: "Years 21–30", rate: path.rates[20] },
    { label: "After 30 years", rate: path.tail },
  ]
}

/** The breakeven matching a plan of `years`: 5-, 10-, 20- or 30-year. */
export function marketRateFor(m: MarketInflation, years: number): { rate: number; horizon: 5 | 10 | 20 | 30 } {
  if (years <= 7) return { rate: m.y5, horizon: 5 }
  if (years <= 15) return { rate: m.y10, horizon: 10 }
  if (years <= 25) return { rate: m.y20, horizon: 20 }
  return { rate: m.y30, horizon: 30 }
}

/** The single rate that reaches the same price level as the path over `years`. */
export function equivalentRate(path: InflationPath, years: number): number {
  return years > 0 ? Math.pow(priceIndex(path, years), 1 / years) - 1 : rateAt(path, 0)
}

/** The plan's inflation: a path when following the market year by year, otherwise its single rate. */
export function inflationOf(settings: Pick<PlanSettings, "inflation" | "inflationMode" | "marketInflation">, years = 100): Inflation {
  if (settings.inflationMode === "marketPath" && settings.marketInflation) return marketPath(settings.marketInflation, years)
  return settings.inflation
}
