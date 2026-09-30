import { resolveTiming, timingContext } from "./plan-timing"
import type { AssetKind, AssetRunningCost, PlanAsset, PlanDocument, PlanExpense } from "./plan-types"

/** Category of generated ownership costs; spending changes (a move, say) don't scale them. */
export const ASSET_COSTS_CATEGORY = "Home & vehicle"

/** Typical yearly costs of owning each kind of asset. */
export const TYPICAL_RUNNING_COSTS: Record<AssetKind, AssetRunningCost[]> = {
  home: [
    { name: "Property tax", amount: 0.011, basis: "percentOfValue" },
    { name: "Insurance", amount: 0.0035, basis: "percentOfValue" },
    { name: "Maintenance", amount: 0.01, basis: "percentOfValue" },
  ],
  vehicle: [
    { name: "Insurance", amount: 1_800, basis: "dollars" },
    { name: "Maintenance", amount: 1_000, basis: "dollars" },
    { name: "Registration & taxes", amount: 400, basis: "dollars" },
  ],
  other: [],
}

/** One year's cost in today's dollars at the asset's value today. */
export function yearlyCost(cost: AssetRunningCost, value: number): number {
  return cost.basis === "dollars" ? cost.amount : cost.amount * value
}

export function totalYearlyCost(asset: PlanAsset): number {
  return (asset.runningCosts ?? []).reduce((s, c) => s + yearlyCost(c, asset.value), 0)
}

/**
 * Running costs as expenses for the years the asset is owned. Dollar costs rise with inflation. A share
 * of value follows the value: bought in year s at today's price grown by inflation, then changing at its
 * own rate, so its cost in year t ≥ s is pct × value × (1 + i)^s × (1 + a)^(t − s) — an expense of
 * pct × value × ((1 + i) / (1 + a))^s growing at a.
 */
export function assetCostExpenses(doc: PlanDocument): PlanExpense[] {
  const ctx = timingContext(doc)
  const inflation = doc.settings.inflation
  const existing = new Set(doc.expenses.map((e) => e.id))
  return doc.assets.flatMap((asset) => {
    const bought = Math.max(0, resolveTiming(asset.start, ctx) ?? 0)
    return (asset.runningCosts ?? []).flatMap((cost, i): PlanExpense[] => {
      const id = `cost-${asset.id}-${i}`
      if (cost.amount <= 0 || existing.has(id)) return []
      const byValue = cost.basis === "percentOfValue"
      const amount = byValue ? cost.amount * asset.value * Math.pow((1 + inflation) / (1 + asset.appreciation), bought) : cost.amount
      return [
        {
          id,
          name: `${asset.name}: ${cost.name.toLowerCase()}`,
          category: ASSET_COSTS_CATEGORY,
          amount,
          growth: byValue ? asset.appreciation : null,
          start: asset.start,
          end: asset.end,
          oneTime: false,
        },
      ]
    })
  })
}
