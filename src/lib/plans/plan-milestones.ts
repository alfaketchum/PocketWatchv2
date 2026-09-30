import { childMilestones } from "./plan-children"
import type { AssetKind, PlanDocument, PlanMilestone } from "./plan-types"

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

/** Generated milestones: from children and from assets bought or sold. Read-only; edit their source. */
export function generatedMilestones(doc: PlanDocument): PlanMilestone[] {
  return [...childMilestones(doc), ...assetMilestones(doc)]
}

/** The plan's own milestones plus generated ones. Safe on an already-expanded plan (no duplicates). */
export function allMilestones(doc: PlanDocument): PlanMilestone[] {
  const own = new Set(doc.milestones.map((m) => m.id))
  return [...doc.milestones, ...generatedMilestones(doc).filter((m) => !own.has(m.id))]
}
