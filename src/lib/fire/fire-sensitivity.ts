import { fireNumber, yearsToTargetWithWindfalls, type Windfall } from "./fire-projection"

export type LeverKey = "spend" | "invest" | "returns" | "swr"

export interface LeverSide {
  label: string
  /** Change in years to FI; negative = sooner. Null when either side never reaches FI. */
  deltaYears: number | null
}

export interface Lever {
  key: LeverKey
  name: string
  /** The change that brings FI sooner. */
  better: LeverSide
  /** The same-sized change in the other direction. */
  worse: LeverSide
  /** Largest absolute effect of either side, for ranking. */
  impact: number
}

interface SensitivityPlan {
  investable: number
  annualSpend: number
  annualContribution: number
  swr: number
  realReturn: number
  windfalls: Windfall[]
}

const SPEND_STEP = 0.1
const INVEST_STEP_MONTHLY = 500
const RETURN_STEP = 0.01
const SWR_STEP = 0.0025

function years(p: SensitivityPlan, patch: Partial<SensitivityPlan>): number | null {
  const q = { ...p, ...patch }
  return yearsToTargetWithWindfalls(q.investable, Math.max(0, q.annualContribution), q.realReturn, fireNumber(Math.max(0, q.annualSpend), q.swr), q.windfalls)
}

/**
 * What moves the FI date, both directions per lever, ranked by impact (a tornado chart).
 * Spending changes also change what you can invest by the same amount.
 */
export function fiSensitivity(plan: SensitivityPlan): Lever[] {
  const base = years(plan, {})
  const delta = (v: number | null) => (base === null || v === null ? null : v - base)
  const spend = plan.annualSpend * SPEND_STEP
  const invest = INVEST_STEP_MONTHLY * 12

  const levers: Omit<Lever, "impact">[] = [
    {
      key: "spend",
      name: "Spending",
      better: { label: `Spend ${SPEND_STEP * 100}% less`, deltaYears: delta(years(plan, { annualSpend: plan.annualSpend - spend, annualContribution: plan.annualContribution + spend })) },
      worse: { label: `Spend ${SPEND_STEP * 100}% more`, deltaYears: delta(years(plan, { annualSpend: plan.annualSpend + spend, annualContribution: plan.annualContribution - spend })) },
    },
    {
      key: "invest",
      name: "Investing",
      better: { label: `Invest $${INVEST_STEP_MONTHLY}/mo more`, deltaYears: delta(years(plan, { annualContribution: plan.annualContribution + invest })) },
      worse: { label: `Invest $${INVEST_STEP_MONTHLY}/mo less`, deltaYears: delta(years(plan, { annualContribution: plan.annualContribution - invest })) },
    },
    {
      key: "returns",
      name: "Returns",
      better: { label: `Returns ${RETURN_STEP * 100}% higher`, deltaYears: delta(years(plan, { realReturn: plan.realReturn + RETURN_STEP })) },
      worse: { label: `Returns ${RETURN_STEP * 100}% lower`, deltaYears: delta(years(plan, { realReturn: plan.realReturn - RETURN_STEP })) },
    },
    {
      key: "swr",
      name: "Withdrawal rate",
      better: { label: `Withdraw ${(SWR_STEP * 100).toFixed(2)}% more`, deltaYears: delta(years(plan, { swr: plan.swr + SWR_STEP })) },
      worse: { label: `Withdraw ${(SWR_STEP * 100).toFixed(2)}% less`, deltaYears: delta(years(plan, { swr: Math.max(0.005, plan.swr - SWR_STEP) })) },
    },
  ]
  return levers
    .map((l) => ({ ...l, impact: Math.max(Math.abs(l.better.deltaYears ?? 0), Math.abs(l.worse.deltaYears ?? 0)) }))
    .sort((a, b) => b.impact - a.impact)
}
