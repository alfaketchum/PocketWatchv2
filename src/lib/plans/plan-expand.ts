import { childExpenses } from "./plan-children"
import { allMilestones } from "./plan-milestones"
import type { PlanDocument } from "./plan-types"

/**
 * The document the engine and charts work from: generated child expenses and all generated
 * milestones (children, assets) folded in. Children are cleared, so expanding twice is harmless.
 */
export function expandPlan(doc: PlanDocument): PlanDocument {
  return { ...doc, expenses: [...doc.expenses, ...childExpenses(doc)], milestones: allMilestones(doc), children: [] }
}
