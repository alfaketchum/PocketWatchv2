import { FEE_DRAG_ANNUAL } from "./fire-constants"
import type { ResolvedPlan } from "./fire-plan"
import {
  baristaGap,
  baristaNumber,
  coastNumber,
  fireNumber,
  projectPath,
  tierForSpend,
  yearsToCoast,
  yearsToTarget,
} from "./fire-projection"
import { toMonthlyFlows } from "./swr-simulation"
import type { FireInputs, FireTier, FireTierKey, ProjectionPoint, SimOptions } from "./fire-types"

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
  barista: { gapToday: number; number: number; progress: TargetProgress }
  projection: ProjectionPoint[]
}

function progressTo(target: number, plan: ResolvedPlan, inputs: FireInputs, nowYear: number): TargetProgress {
  const years = yearsToTarget(plan.investable, plan.annualContribution, inputs.realReturn, target)
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
  const baristaTarget = baristaNumber(plan.annualSpend, inputs.partTimeIncome, plan.swr)
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
      gapToday: baristaGap(plan.annualSpend, plan.investable, plan.swr),
      number: baristaTarget,
      progress: progressTo(baristaTarget, plan, inputs, nowYear),
    },
    projection: projectPath(plan.investable, plan.annualContribution, inputs.realReturn, inputs.currentAge, horizonYears, nowYear),
  }
}

/** Simulation options for the user's own retirement (allocation, horizon, target, income). */
export function simOptionsForPlan(inputs: FireInputs, retireAge: number, portfolio: number): SimOptions {
  const g = inputs.glidepath
  return {
    equity: g.enabled
      ? { start: g.startEquity, end: g.endEquity, glideMonths: Math.round(g.years * 12) }
      : { start: inputs.equityShare, end: inputs.equityShare, glideMonths: 0 },
    horizonMonths: inputs.horizonYears * 12,
    finalValue: inputs.finalValueTarget,
    feeAnnual: FEE_DRAG_ANNUAL,
    flows: toMonthlyFlows(inputs.flows, retireAge, portfolio),
  }
}
