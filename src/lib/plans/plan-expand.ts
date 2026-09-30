import { assetCostExpenses } from "./plan-asset-costs"
import { childExpenses } from "./plan-children"
import { financingDebts } from "./plan-financing"
import { allMilestones } from "./plan-milestones"
import { withReplacements } from "./plan-replacements"
import type { PlanDocument } from "./plan-types"

/**
 * The document the engine and charts work from: replacement cycles unrolled into successive assets,
 * generated child expenses, assets' running costs and loans from their "How you'll pay", and all
 * generated milestones (children, assets) folded in. Children and cycles are cleared, and generated
 * costs and loans are skipped when already present, so expanding twice is harmless.
 */
export function expandPlan(doc: PlanDocument): PlanDocument {
  const withAssets = { ...doc, assets: withReplacements(doc) }
  return {
    ...withAssets,
    expenses: [...doc.expenses, ...childExpenses(doc), ...assetCostExpenses(withAssets)],
    debts: [...doc.debts, ...financingDebts(withAssets)],
    milestones: allMilestones(withAssets),
    children: [],
  }
}
