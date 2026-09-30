import { simulatePlan } from "./engine/simulate"
import { expandPlan } from "./plan-expand"
import { loanPayoffs, PAYOFF_ICON, payoffName } from "./plan-loan-parts"
import type { PlanDocument, PlanMilestone } from "./plan-types"

/**
 * "Mortgage paid off" milestones for the Milestones tab, one per loan cleared within the plan. The year comes
 * from running the plan, so they're read-only and move when the loan, its payment or the asset sale changes.
 */
export function payoffMilestones(doc: PlanDocument): PlanMilestone[] {
  // Loans include those generated for financed purchases.
  const expanded = expandPlan(doc)
  if (expanded.debts.length === 0) return []
  return loanPayoffs(expanded, simulatePlan(doc).rows).map(({ debt, row }) => ({
    id: `payoff-${debt.id}`,
    name: payoffName(debt),
    kind: "asset",
    icon: PAYOFF_ICON,
    timing: { type: "year", year: row.year },
  }))
}
