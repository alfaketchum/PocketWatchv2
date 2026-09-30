import { assetCostExpenses } from "./plan-asset-costs"
import { childExpenses } from "./plan-children"
import { financingDebts } from "./plan-financing"
import { allMilestones } from "./plan-milestones"
import type { PlanDocument } from "./plan-types"

/**
 * The document the engine and charts work from: generated child expenses, assets' running costs and
 * loans from their "How you'll pay", and all generated milestones (children, assets) folded in.
 * Children are cleared, and generated costs and loans are skipped when already present, so expanding
 * twice is harmless.
 */
export function expandPlan(doc: PlanDocument): PlanDocument {
  return {
    ...doc,
    expenses: [...doc.expenses, ...childExpenses(doc), ...assetCostExpenses(doc)],
    debts: [...doc.debts, ...financingDebts(doc)],
    milestones: allMilestones(doc),
    children: [],
  }
}
