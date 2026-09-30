import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, PlanProjection, TaxTreatment, YearRow } from "./plan-types"

/** Stack order, bottom to top. Debt is drawn below zero. */
export const NET_WORTH_LAYERS = ["cash", "taxable", "taxDeferred", "taxFree", "realAssetEquity"] as const

export type NetWorthLayer = (typeof NET_WORTH_LAYERS)[number]

export const NET_WORTH_LAYER_LABELS: Record<NetWorthLayer | "debt", string> = {
  cash: "Cash",
  taxable: "Taxable",
  taxDeferred: "Tax-deferred",
  taxFree: "Tax-free",
  realAssetEquity: "Real-asset equity",
  debt: "Debt",
}

const LAYER_FOR: Record<TaxTreatment, NetWorthLayer> = {
  cash: "cash",
  taxable: "taxable",
  traditional: "taxDeferred",
  roth: "taxFree",
  hsa: "taxFree",
}

export type NetWorthPoint = { age: number; year: number; netWorth: number; debt: number } & Record<NetWorthLayer, number>

interface Balances {
  accounts: Record<string, number>
  assets: Record<string, number>
  debts: Record<string, number>
}

/**
 * One point's layers. Each asset's equity is its value minus the loans linked to it; loans beyond
 * the asset's value (underwater) and unlinked debts make up the debt layer (negative).
 */
export function layersFor(doc: PlanDocument, balances: Balances): Record<NetWorthLayer, number> & { debt: number } {
  const layers = { cash: 0, taxable: 0, taxDeferred: 0, taxFree: 0, realAssetEquity: 0, debt: 0 }
  for (const account of doc.accounts) layers[LAYER_FOR[account.taxTreatment]] += balances.accounts[account.id] ?? 0
  const linked = new Set<string>()
  for (const asset of doc.assets) {
    const value = balances.assets[asset.id]
    if (value === undefined) continue
    const loans = doc.debts.filter((d) => d.assetId === asset.id)
    loans.forEach((d) => linked.add(d.id))
    const owed = loans.reduce((s, d) => s + (balances.debts[d.id] ?? 0), 0)
    layers.realAssetEquity += Math.max(0, value - owed)
    layers.debt -= Math.max(0, owed - value)
  }
  for (const debt of doc.debts) {
    if (!linked.has(debt.id)) layers.debt -= balances.debts[debt.id] ?? 0
  }
  return layers
}

function point(doc: PlanDocument, age: number, year: number, balances: Balances): NetWorthPoint {
  const layers = layersFor(doc, balances)
  const netWorth = NET_WORTH_LAYERS.reduce((s, k) => s + layers[k], 0) + layers.debt
  return { ...layers, age, year, netWorth }
}

/** One bar per plan year, labeled by the age during that year, holding that year's closing balances. */
export function netWorthPoints(doc: PlanDocument, rows: YearRow[]): NetWorthPoint[] {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  return rows.map((r) => point(doc, age0 + r.index, r.year, { accounts: r.balances, assets: r.assetValues, debts: r.debtBalances }))
}

export interface ChartMilestone {
  name: string
  kind: "retirement" | "custom" | "depleted"
  age: number
  year: number
}

/** Milestones (and the year money runs out) positioned by age. */
export function chartMilestones(doc: PlanDocument, projection: PlanProjection): ChartMilestone[] {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const ctx = timingContext(doc)
  const marks: ChartMilestone[] = doc.milestones.flatMap((m) => {
    const index = resolveTiming(m.timing, ctx)
    if (index === null || index < 0 || index >= ctx.length) return []
    return [{ name: m.name, kind: m.kind, age: age0 + index, year: doc.settings.startYear + index }]
  })
  const depleted = projection.rows.find((r) => r.shortfall > 0.5)
  if (depleted) marks.push({ name: "Money runs out", kind: "depleted", age: age0 + depleted.index, year: depleted.year })
  return marks
}
