import { fireNumber, yearsToTarget } from "./fire-projection"

export interface GrowthYear {
  year: number
  /** What you add that year (stops at FI). */
  contributed: number
  /** What the market adds that year at the plan's real return. */
  market: number
}

export interface GrowthSplit {
  years: GrowthYear[]
  /** First year the market adds more than you contribute; 0 if already true today. */
  crossoverYear: number | null
}

/**
 * Savings vs market growth by year ("the flywheel"): as the portfolio grows, returns overtake
 * contributions. Deterministic at the plan's real return; contributions stop once FI is reached.
 */
export function growthSplit(
  investable: number,
  annualContribution: number,
  r: number,
  target: number,
  span: number,
  startYear: number,
): GrowthSplit {
  const years: GrowthYear[] = []
  let value = investable
  let crossoverYear: number | null = null
  for (let i = 1; i <= span; i++) {
    const contributed = value >= target ? 0 : annualContribution
    const market = value * r
    if (crossoverYear === null && market > contributed && contributed > 0) crossoverYear = startYear + i - 1
    years.push({ year: startYear + i - 1, contributed, market })
    value = value + market + contributed
  }
  return { years, crossoverYear }
}

export interface SavingsRatePoint {
  rate: number
  years: number | null
}

const RATE_STEPS = Array.from({ length: 18 }, (_, i) => (i + 1) * 0.05)

/** Years to FI when `rate` of take-home `income` is invested and the rest is spent (also in retirement). */
export function yearsAtSavingsRate(investable: number, income: number, rate: number, r: number, swr: number): number | null {
  return yearsToTarget(investable, income * rate, r, fireNumber(income * (1 - rate), swr))
}

/**
 * Mr. Money Mustache's "Shockingly Simple Math", personalized: for a fixed take-home income
 * (spend + contributions), years to FI at each savings rate from today's portfolio.
 */
export function savingsRateCurve(
  investable: number,
  annualSpend: number,
  annualContribution: number,
  r: number,
  swr: number,
): { points: SavingsRatePoint[]; current: SavingsRatePoint | null } {
  const income = annualSpend + annualContribution
  if (income <= 0) return { points: [], current: null }
  const at = (rate: number) => yearsAtSavingsRate(investable, income, rate, r, swr)
  const currentRate = annualContribution / income
  return {
    points: RATE_STEPS.map((rate) => ({ rate, years: at(rate) })),
    current: { rate: currentRate, years: at(currentRate) },
  }
}
