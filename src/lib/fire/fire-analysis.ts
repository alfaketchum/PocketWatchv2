import { FEE_DRAG_ANNUAL } from "./fire-constants"
import type { ResolvedPlan } from "./fire-plan"
import {
  yearsToTargetWithWindfalls,
  type Windfall,
  baristaNumber,
  coastNumber,
  fireNumber,
  projectPath,
  tierForSpend,
  yearsToCoast,
  yearsToTarget,
} from "./fire-projection"
import { failsafe, successRate, summarizeCohorts, toMonthlyFlows } from "./swr-simulation"
import type { EquityPlan, FireInputs, FireTier, FireTierKey, MarketHistory, ProjectionPoint, SimOptions } from "./fire-types"

export interface TargetProgress {
  target: number
  progress: number
  years: number | null
  age: number | null
  year: number | null
}

export interface TierProgress extends TargetProgress {
  tier: FireTier
}

export interface PlanAnalysis {
  fireNumber: number
  yourTarget: TargetProgress
  retireAge: number
  tiers: TierProgress[]
  currentTier: FireTierKey | null
  coast: { number: number; reached: boolean; yearsToCoast: number | null; coastAge: number }
  barista: {
    number: number
    progress: TargetProgress
    partTimeYears: number | null
    /** Age you'd leave full-time work, and the age part-time work ends (null = never / unreachable). */
    downshiftAge: number | null
    fullRetireAge: number | null
  }
  projection: ProjectionPoint[]
}

/** One-time inflows still ahead, as years from now. */
export function windfallsFor(inputs: FireInputs): Windfall[] {
  return inputs.lumpSums
    .map((l) => ({ yearsFromNow: l.age - inputs.currentAge, amount: l.amount }))
    .filter((w) => w.yearsFromNow > 0 && w.amount > 0)
}

function progressTo(target: number, plan: ResolvedPlan, inputs: FireInputs, nowYear: number): TargetProgress {
  const years = yearsToTargetWithWindfalls(plan.investable, plan.annualContribution, inputs.realReturn, target, windfallsFor(inputs))
  return {
    target,
    progress: target > 0 ? Math.min(1, plan.investable / target) : 1,
    years,
    age: years !== null ? inputs.currentAge + years : null,
    year: years !== null ? nowYear + years : null,
  }
}

export function analyzePlan(inputs: FireInputs, plan: ResolvedPlan, nowYear: number): PlanAnalysis {
  const number = fireNumber(plan.annualSpend, plan.swr)
  const yourTarget = progressTo(number, plan, inputs, nowYear)
  const retireAge = yourTarget.age ?? inputs.coastAge
  const yearsToCoastAge = Math.max(0, inputs.coastAge - inputs.currentAge)
  const coastTarget = coastNumber(number, yearsToCoastAge, inputs.realReturn)
  const baristaTarget = baristaNumber(plan.annualSpend, inputs.partTimeIncome, plan.swr, inputs.realReturn, inputs.partTimeYears)
  const baristaProgress = progressTo(baristaTarget, plan, inputs, nowYear)
  const tiers = inputs.tiers.map((tier) => ({
    tier,
    ...progressTo(fireNumber(tier.annualSpend, plan.swr), plan, inputs, nowYear),
  }))
  const horizonYears = Math.max(
    (yourTarget.years ?? yearsToCoastAge) + 5,
    yearsToCoastAge,
    ...tiers.slice(0, 3).map((t) => t.years ?? 0),
  )

  return {
    fireNumber: number,
    yourTarget,
    retireAge,
    tiers,
    currentTier: tierForSpend(inputs.tiers, plan.annualSpend),
    coast: {
      number: coastTarget,
      reached: plan.investable >= coastTarget,
      yearsToCoast: yearsToCoast(plan.investable, plan.annualContribution, inputs.realReturn, number, yearsToCoastAge),
      coastAge: inputs.coastAge,
    },
    barista: {
      number: baristaTarget,
      progress: baristaProgress,
      partTimeYears: inputs.partTimeYears,
      downshiftAge: baristaProgress.age,
      fullRetireAge:
        baristaProgress.age !== null && inputs.partTimeYears !== null ? baristaProgress.age + inputs.partTimeYears : null,
    },
    projection: projectPath(plan.investable, plan.annualContribution, inputs.realReturn, inputs.currentAge, horizonYears, nowYear, windfallsFor(inputs)),
  }
}

/** Lump sums arriving after retirement enter the simulation as a single month's inflow. */
function lumpFlows(inputs: FireInputs, retireAge: number, portfolio: number) {
  if (portfolio <= 0) return []
  return inputs.lumpSums
    .filter((l) => l.amount > 0 && l.age >= retireAge)
    .map((l) => {
      const startMonth = Math.round((l.age - retireAge) * 12)
      return { startMonth, endMonth: startMonth + 1, amount: l.amount / portfolio }
    })
}

export interface SimShares {
  stocks: number
  bonds: number
  cash: number
}

function allocationPlan(inputs: FireInputs, portfolioShares: SimShares | null): EquityPlan {
  if (inputs.allocationSource === "portfolio" && portfolioShares && portfolioShares.stocks + portfolioShares.bonds + portfolioShares.cash > 0) {
    return { start: portfolioShares.stocks, end: portfolioShares.stocks, glideMonths: 0, cash: portfolioShares.cash }
  }
  const g = inputs.glidepath
  return g.enabled
    ? { start: g.startEquity, end: g.endEquity, glideMonths: Math.round(g.years * 12) }
    : { start: inputs.equityShare, end: inputs.equityShare, glideMonths: 0 }
}

/**
 * Simulation options for the user's own retirement. With `allocationSource: "portfolio"`
 * the mix comes from their actual accounts; otherwise from the manual share or glidepath.
 */
export function simOptionsForPlan(
  inputs: FireInputs,
  retireAge: number,
  portfolio: number,
  portfolioShares: SimShares | null = null,
): SimOptions {
  return {
    equity: allocationPlan(inputs, portfolioShares),
    horizonMonths: inputs.horizonYears * 12,
    finalValue: inputs.finalValueTarget,
    feeAnnual: FEE_DRAG_ANNUAL,
    flows: [...toMonthlyFlows(inputs.flows, retireAge, portfolio), ...lumpFlows(inputs, retireAge, portfolio)],
  }
}

export interface ExtraYearResult {
  extraYears: number
  retireAge: number
  portfolio: number
  withdrawalRate: number
  successRate: number | null
  /** Spending the worst historical cohort could have sustained from this portfolio. */
  safeSpend: number | null
}

/**
 * ERN's "one more year" question: keep working n extra years past the FI date, then
 * retire on the same spending. A bigger portfolio lowers the withdrawal rate.
 */
export function oneMoreYear(
  inputs: FireInputs,
  analysis: PlanAnalysis,
  plan: { investable: number; annualSpend: number; annualContribution: number },
  history: MarketHistory,
  portfolioShares: SimShares | null,
  maxExtra = 5,
): ExtraYearResult[] {
  const r = inputs.realReturn
  // Already FI: the extra years start from today's (larger) portfolio.
  const base = analysis.yourTarget.years === 0 ? Math.max(plan.investable, analysis.fireNumber) : analysis.fireNumber
  const out: ExtraYearResult[] = []
  for (let n = 0; n <= maxExtra; n++) {
    const growth = Math.pow(1 + r, n)
    const added = Math.abs(r) < 1e-9 ? plan.annualContribution * n : (plan.annualContribution * (growth - 1)) / r
    const portfolio = base * growth + added
    const retireAge = analysis.retireAge + n
    const opts = simOptionsForPlan(inputs, retireAge, portfolio, portfolioShares)
    const wr = portfolio > 0 ? plan.annualSpend / portfolio : 0
    const worst = failsafe(summarizeCohorts(history, opts))
    out.push({
      extraYears: n,
      retireAge,
      portfolio,
      withdrawalRate: wr,
      successRate: successRate(history, wr, opts),
      safeSpend: worst ? worst.wr * portfolio : null,
    })
  }
  return out
}

/**
 * Historical check of the Barista bridge: start at the Barista number on the downshift date,
 * with part-time income as a temporary inflow (like ERN's supplemental cash flows), then full retirement.
 */
export function baristaSimOptions(
  inputs: FireInputs,
  downshiftAge: number,
  portfolio: number,
  portfolioShares: SimShares | null,
): SimOptions {
  const base = simOptionsForPlan(inputs, downshiftAge, portfolio, portfolioShares)
  if (portfolio <= 0 || inputs.partTimeIncome <= 0) return base
  const endMonth = inputs.partTimeYears === null ? Number.MAX_SAFE_INTEGER : Math.round(inputs.partTimeYears * 12)
  return { ...base, flows: [...base.flows, { startMonth: 0, endMonth, amount: inputs.partTimeIncome / 12 / portfolio }] }
}
