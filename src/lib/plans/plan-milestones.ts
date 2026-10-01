import { childMilestones } from "./plan-children"
import type { AssetKind, PlanDocument, PlanIncome, PlanMilestone } from "./plan-types"

const BUY_ICONS: Record<AssetKind, string> = { home: "home", vehicle: "directions_car", other: "shopping_bag" }

/** "Buy the house" / "Replace the car" / "Sell the car" milestones for assets bought or sold during the plan. */
export function assetMilestones(doc: PlanDocument): PlanMilestone[] {
  return doc.assets.flatMap((asset) => {
    const marks: PlanMilestone[] = []
    if (asset.replacementOf) {
      marks.push({ id: `asset-${asset.id}-buy`, name: `Replace ${asset.name}`, kind: "asset", icon: "autorenew", timing: asset.start })
    } else if (asset.start.type !== "planStart") {
      const received = asset.acquired === "received"
      marks.push({
        id: `asset-${asset.id}-buy`,
        name: `${received ? "Receive" : "Buy"} ${asset.name}`,
        kind: "asset",
        icon: received ? "volunteer_activism" : BUY_ICONS[asset.kind],
        timing: asset.start,
      })
    }
    if (asset.end.type !== "planEnd" && !asset.replaced) {
      marks.push({ id: `asset-${asset.id}-sell`, name: `Sell ${asset.name}`, kind: "asset", icon: "sell", timing: asset.end })
    }
    return marks
  })
}

/** Incomes that mark a life stage when they start later on: claiming Social Security, a pension. */
const STAGE_INCOMES: Partial<Record<PlanIncome["kind"], string>> = { social_security: "elderly", pension: "account_balance" }

/** "Claim Social Security" / "Pension starts" markers; incomes already timed to a milestone have one. */
export function incomeMilestones(doc: PlanDocument): PlanMilestone[] {
  return doc.incomes.flatMap((income) => {
    const icon = STAGE_INCOMES[income.kind]
    if (!icon || income.oneTime || income.start.type === "planStart" || income.start.type === "milestone") return []
    const name = income.kind === "social_security" ? `Claim ${income.name}` : `${income.name} starts`
    return [{ id: `income-${income.id}-start`, name, kind: "income" as const, icon, timing: income.start }]
  })
}

/** Generated milestones: from children, assets bought or sold, and incomes that start a life stage. Read-only; edit their source. */
export function generatedMilestones(doc: PlanDocument): PlanMilestone[] {
  return [...childMilestones(doc), ...assetMilestones(doc), ...incomeMilestones(doc)]
}

/** The plan's own milestones plus generated ones. Safe on an already-expanded plan (no duplicates). */
export function allMilestones(doc: PlanDocument): PlanMilestone[] {
  const own = new Set(doc.milestones.map((m) => m.id))
  return [...doc.milestones, ...generatedMilestones(doc).filter((m) => !own.has(m.id))]
}
