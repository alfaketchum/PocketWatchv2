import { fireNumber, yearsToTargetWithWindfalls, type Windfall } from "./fire-projection"

export interface SensitivityItem {
  key: "spend" | "invest" | "returns"
  label: string
  /** Change in years to FI; negative = sooner. Null when either side never reaches FI. */
  deltaYears: number | null
}

interface SensitivityPlan {
  investable: number
  annualSpend: number
  annualContribution: number
  swr: number
  realReturn: number
  windfalls: Windfall[]
}

const SPEND_CUT = 0.1
const EXTRA_MONTHLY = 500
const RETURN_DROP = 0.01

function years(p: SensitivityPlan, patch: Partial<SensitivityPlan>): number | null {
  const q = { ...p, ...patch }
  return yearsToTargetWithWindfalls(q.investable, q.annualContribution, q.realReturn, fireNumber(q.annualSpend, q.swr), q.windfalls)
}

/** What moves the FI date most: spending less, investing more, or lower returns. */
export function fiSensitivity(plan: SensitivityPlan): SensitivityItem[] {
  const base = years(plan, {})
  const delta = (v: number | null) => (base === null || v === null ? null : v - base)
  const spendCut = plan.annualSpend * SPEND_CUT
  return [
    {
      key: "spend",
      label: `Spend ${SPEND_CUT * 100}% less`,
      deltaYears: delta(years(plan, { annualSpend: plan.annualSpend - spendCut, annualContribution: plan.annualContribution + spendCut })),
    },
    {
      key: "invest",
      label: `Invest $${EXTRA_MONTHLY}/mo more`,
      deltaYears: delta(years(plan, { annualContribution: plan.annualContribution + EXTRA_MONTHLY * 12 })),
    },
    {
      key: "returns",
      label: `Returns ${RETURN_DROP * 100}% lower`,
      deltaYears: delta(years(plan, { realReturn: plan.realReturn - RETURN_DROP })),
    },
  ]
}
