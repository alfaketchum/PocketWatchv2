/**
 * Withdrawal strategies through historical cohorts (as FI Calc does, in ERN's monthly framework).
 * Spending is set at the start of each retirement year and withdrawn monthly in equal parts.
 * Everything is in real (inflation-adjusted) terms, relative to the planned first-year spending.
 */
import { capeWithdrawalRate } from "./cape-rule"
import { cohortCount, equityAt, monthFactor } from "./swr-simulation"
import type { EquityPlan, MarketHistory } from "./fire-types"

export type StrategyKey = "fixed" | "percent" | "cape" | "guardrails"

export const STRATEGIES: { key: StrategyKey; label: string; description: string }[] = [
  { key: "fixed", label: "Fixed dollars (4% rule style)", description: "Same real spending every year, whatever markets do." },
  { key: "percent", label: "% of portfolio", description: "Spend your withdrawal rate × this year's portfolio. Never runs out; spending swings." },
  { key: "cape", label: "CAPE rule (ERN)", description: "Spend (a + b ÷ CAPE) × this year's portfolio. Adapts to valuations." },
  { key: "guardrails", label: "Guardrails (Guyton-Klinger)", description: "Cut 10% when your rate drifts 20% above plan, raise 10% when 20% below." },
]

/** Guyton-Klinger guardrail band and step. */
export const GUARDRAIL_BAND = 0.2
export const GUARDRAIL_STEP = 0.1

/**
 * Guyton-Klinger: the change to this year's spending when it's `rate` of the portfolio against a starting rate
 * of `initialRate`. Above the upper guardrail cut by `step`, below the lower one raise by `step`; else keep it.
 * Returns the multiplier on last year's spending (shared by the FIRE lab and plans).
 */
export function guardrailStep(rate: number, initialRate: number, band = GUARDRAIL_BAND, step = GUARDRAIL_STEP): number {
  if (rate > initialRate * (1 + band)) return 1 - step
  if (rate < initialRate * (1 - band)) return 1 + step
  return 1
}

export interface StrategyOptions {
  strategy: StrategyKey
  /** Planned initial withdrawal rate. */
  wr: number
  horizonYears: number
  equity: EquityPlan
  feeAnnual: number
  capeA: number
  capeB: number
}

export interface StrategyPath {
  /** Real spending per retirement year, as a multiple of the planned first-year spending. */
  spending: number[]
  depleted: boolean
  /** Final real portfolio as a multiple of the starting portfolio. */
  finalValue: number
}

function yearlySpend(opts: StrategyOptions, value: number, prev: number | null, cape: number | null): number {
  switch (opts.strategy) {
    case "fixed":
      return opts.wr
    case "percent":
      return opts.wr * value
    case "cape":
      return (cape ? capeWithdrawalRate(cape, opts.capeA, opts.capeB) : opts.wr) * value
    case "guardrails": {
      if (prev === null) return opts.wr
      return prev * guardrailStep(value > 0 ? prev / value : Infinity, opts.wr)
    }
  }
}

/** One cohort; the portfolio starts at 1, spending is reported relative to `wr` (the planned amount). */
export function simulateStrategy(h: MarketHistory, start: number, opts: StrategyOptions): StrategyPath {
  const feeMonthly = opts.feeAnnual / 12
  const cash = opts.equity.cash ?? 0
  const spending: number[] = []
  let value = 1
  let prev: number | null = null
  let depleted = false
  for (let y = 0; y < opts.horizonYears; y++) {
    const annual: number = depleted ? 0 : yearlySpend(opts, value, prev, h.cape[start + y * 12] ?? null)
    prev = annual
    let spent = 0
    for (let m = 0; m < 12; m++) {
      const t = y * 12 + m
      const draw = Math.min(value, annual / 12)
      spent += draw
      value = (value - draw) * monthFactor(h, start + t, equityAt(opts.equity, t), cash, feeMonthly)
      if (value <= 1e-9) {
        value = 0
        depleted = true
      }
    }
    spending.push(spent / opts.wr)
  }
  return { spending, depleted, finalValue: value }
}

export interface StrategySummary {
  key: StrategyKey
  /** Share of cohorts that never ran out of money. */
  successRate: number
  /** 10th-percentile of each cohort's lowest spending year, relative to plan (1 = as planned). */
  lowSpend: number
  /** Median of each cohort's median spending, relative to plan. */
  typicalSpend: number
  /** Median final real portfolio relative to the start. */
  medianFinal: number
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b)
  return v.length ? v[Math.floor((v.length - 1) / 2)] : NaN
}

function p10(values: number[]): number {
  const v = [...values].sort((a, b) => a - b)
  return v.length ? v[Math.floor((v.length - 1) * 0.1)] : NaN
}

export function summarizeStrategy(h: MarketHistory, opts: StrategyOptions): StrategySummary {
  const count = cohortCount(h, opts.horizonYears * 12)
  let ok = 0
  const lows: number[] = []
  const typical: number[] = []
  const finals: number[] = []
  for (let s = 0; s < count; s++) {
    const path = simulateStrategy(h, s, opts)
    if (!path.depleted) ok++
    lows.push(Math.min(...path.spending))
    typical.push(median(path.spending))
    finals.push(path.finalValue)
  }
  return {
    key: opts.strategy,
    successRate: count ? ok / count : NaN,
    lowSpend: p10(lows),
    typicalSpend: median(typical),
    medianFinal: median(finals),
  }
}
