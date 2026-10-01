import { realRate } from "./plan-dollars"
import { NATIONAL_PROPERTY_TAX_RATE, propertyTaxRate } from "./tax/property-tax-rates"
import { resolveTiming, timingContext } from "./plan-timing"
import type { AssetKind, AssetRunningCost, PlanAsset, PlanDocument, PlanExpense } from "./plan-types"

/** Category of generated ownership costs; spending changes (a move, say) don't scale them. */
export const ASSET_COSTS_CATEGORY = "Home & vehicle"

/** Typical yearly costs of owning each kind of asset (a home's property tax: the national average). */
export const TYPICAL_RUNNING_COSTS: Record<AssetKind, AssetRunningCost[]> = {
  home: [
    { name: "Property tax", amount: NATIONAL_PROPERTY_TAX_RATE, basis: "percentOfValue", kind: "propertyTax" },
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

/** Typical costs for an asset in the plan's state: a home's property tax at that state's effective rate. */
export function typicalRunningCosts(kind: AssetKind, state: string | null | undefined): AssetRunningCost[] {
  return TYPICAL_RUNNING_COSTS[kind].map((c) => (c.kind === "propertyTax" ? { ...c, amount: propertyTaxRate(state) } : c))
}

/**
 * Typical costs for an asset that may come with its real tax bill (a looked-up home): the bill becomes its
 * own effective rate, so it follows the home's value from there; otherwise the state's average.
 */
export function runningCostsFor(kind: AssetKind, state: string | null | undefined, known?: { value: number; propertyTaxAnnual?: number | null }): AssetRunningCost[] {
  const costs = typicalRunningCosts(kind, state)
  const bill = known?.propertyTaxAnnual
  if (kind !== "home" || !bill || !known || known.value <= 0) return costs
  return costs.map((c) => (c.kind === "propertyTax" ? { ...c, name: "Property tax (your bill)", amount: bill / known.value } : c))
}

/** Property tax (itemizable): flagged, or named so in plans saved before the flag existed. */
export function isPropertyTax(cost: AssetRunningCost): boolean {
  return cost.kind === "propertyTax" || /property tax/i.test(cost.name)
}

/**
 * You live in this home: its sale can use the home-sale exclusion, and its property tax and mortgage
 * interest are personal (itemizable). Rented homes never are; otherwise bought homes are unless unticked,
 * inherited ones aren't unless ticked.
 */
export function livesIn(asset: Pick<PlanAsset, "kind" | "rental" | "primaryResidence" | "acquired">): boolean {
  if (asset.kind !== "home" || asset.rental) return false
  return asset.primaryResidence ?? asset.acquired !== "received"
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
 * of value follows the value, which keeps its real appreciation r = (1 + a) / (1 + i) − 1: its cost in year
 * t ≥ s is pct × value × P(t) × (1 + r)^(t − s), with P the price level — an expense of
 * pct × value × (1 + r)^−s rising with inflation plus r. On one rate that is pct × value × (1 + i)^s × (1 + a)^(t − s).
 */
export function assetCostExpenses(doc: PlanDocument): PlanExpense[] {
  const ctx = timingContext(doc)
  const existing = new Set(doc.expenses.map((e) => e.id))
  return doc.assets.flatMap((asset) => {
    const bought = Math.max(0, resolveTiming(asset.start, ctx) ?? 0)
    return (asset.runningCosts ?? []).flatMap((cost, i): PlanExpense[] => {
      const id = `cost-${asset.id}-${i}`
      if (cost.amount <= 0 || existing.has(id)) return []
      const byValue = cost.basis === "percentOfValue"
      const real = realRate(asset.appreciation, doc.settings.inflation)
      const amount = byValue ? (cost.amount * asset.value) / Math.pow(1 + real, bought) : cost.amount
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
          costOf: { assetId: asset.id, propertyTax: isPropertyTax(cost), ...(byValue ? { realGrowth: real } : {}) },
        },
      ]
    })
  })
}
