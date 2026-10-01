import { inflationOf } from "./plan-inflation"
import { simulatePlan } from "./engine/simulate"
import { FI_MILESTONE_ID, FI_SAFE_WITHDRAWAL_RATE } from "./plan-constants"
import { rowInTodaysDollars } from "./plan-dollars"
import type { PlanDocument, PlanMilestone } from "./plan-types"

export interface FiMilestone {
  milestone: PlanMilestone
  /** Average yearly spending across the plan's spending years, today's dollars. */
  averageExpenses: number
  /** Nest egg covering that spending: averageExpenses / FI_SAFE_WITHDRAWAL_RATE. */
  target: number
  /** Whether the plan's accounts reach the target before the plan ends. */
  reached: boolean
}

/**
 * Read-only "Financial independence" milestone for the Milestones tab: the year the plan's
 * investment accounts first cover average yearly spending at a 3.5% withdrawal rate, all in
 * today's dollars. It moves with the plan — edit spending, income or accounts and the year
 * shifts. Null when the plan has no spending years.
 */
export function fiMilestone(doc: PlanDocument): FiMilestone | null {
  const rows = simulatePlan(doc).rows.map((r) => rowInTodaysDollars(r, inflationOf(doc.settings)))
  const spendingYears = rows.filter((r) => r.expenses > 0)
  if (spendingYears.length === 0) return null
  const averageExpenses = spendingYears.reduce((sum, r) => sum + r.expenses, 0) / spendingYears.length
  const target = averageExpenses / FI_SAFE_WITHDRAWAL_RATE
  const hit = rows.find((r) => r.accountsTotal >= target)
  return {
    milestone: {
      id: FI_MILESTONE_ID,
      name: "Financial independence",
      kind: "custom",
      icon: "workspace_premium",
      timing: { type: "year", year: hit?.year ?? doc.settings.startYear + rows.length },
    },
    averageExpenses,
    target,
    reached: hit !== undefined,
  }
}
