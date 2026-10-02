import { priceIndex, type Inflation } from "../plan-inflation"
import type { EquityGrant, PlanIncome } from "../plan-types"

/** A single stock's typical yearly swing (large caps run 25–35%, younger tech 40–60%). */
export const DEFAULT_STOCK_VOLATILITY = 0.4

/** Standard normal CDF (Abramowitz & Stegun 26.2.17; error under 1e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const tail = (Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)) * poly
  return x >= 0 ? 1 - tail : tail
}

/**
 * Expected max(S − K, 0) when the price S ends up lognormal around `expected` with yearly volatility σ over
 * `years`: Black–Scholes' payoff without discounting, and with the plan's own growth in place of the risk-free
 * rate. Good outcomes count and bad ones stop at zero, so an option is worth more than today's gain alone.
 */
export function expectedCallPayoff(expected: number, strike: number, volatility: number, years: number): number {
  const spread = volatility * Math.sqrt(Math.max(0, years))
  if (strike <= 0) return expected
  if (spread <= 0 || expected <= 0) return Math.max(0, expected - strike)
  const d1 = (Math.log(expected / strike) + (spread * spread) / 2) / spread
  return expected * normalCdf(d1) - strike * normalCdf(d1 - spread)
}

/**
 * How a grant's stock price moves: `factor` is the price in plan year `index` over today's. Planned runs grow it
 * at the income's growth and value options at their expected gain; replayed runs (stress test) follow one market
 * path, so an option pays exactly what that path leaves above the strike.
 */
export interface EquityPricing {
  factor: (income: PlanIncome, index: number) => number
  realized: boolean
}

export function plannedPricing(inflation: Inflation): EquityPricing {
  return {
    factor: (income, index) => (income.growth === null ? priceIndex(inflation, index) : Math.pow(1 + income.growth, index)),
    realized: false,
  }
}

/** Compounds each year's stock return from `returnFor` (the price at `index` has had `index` years of returns). */
export function replayedPricing(returnFor: (income: PlanIncome, index: number) => number): EquityPricing {
  const paths = new Map<string, number[]>()
  const factor = (income: PlanIncome, index: number) => {
    const path = paths.get(income.id) ?? [1]
    for (let t = path.length; t <= index; t++) path.push(path[t - 1] * (1 + returnFor(income, t - 1)))
    paths.set(income.id, path)
    return path[index]
  }
  return { factor, realized: true }
}

/** A grant's pay in plan year `index`, nominal: vesting shares at that year's price, or an option's gain. */
export function equityGross(grant: EquityGrant, income: PlanIncome, index: number, pricing: EquityPricing): number {
  const price = grant.price * pricing.factor(income, index)
  if (grant.strike === undefined) return grant.shares * price
  if (pricing.realized) return grant.shares * Math.max(0, price - grant.strike)
  return grant.shares * expectedCallPayoff(price, grant.strike, grant.volatility ?? DEFAULT_STOCK_VOLATILITY, index)
}

/** Today's value of a grant, shown as the income's amount: a year's vesting, or the gain at today's price. */
export function equityValueToday(grant: EquityGrant): number {
  const perShare = grant.strike === undefined ? grant.price : Math.max(0, grant.price - grant.strike)
  return Math.round(grant.shares * perShare)
}
