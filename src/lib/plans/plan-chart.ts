import { interestKey, loanPayoffs, loanSplit, PAYOFF_ICON, payoffName, principalKey } from "./plan-loan-parts"
import { ageAtStart, resolveTiming, timingContext } from "./plan-timing"
import type { MilestoneKind, PlanDocument, PlanProjection, TaxTreatment, YearRow } from "./plan-types"

/** Stack order, bottom to top; debt (mortgages and car loans included) is drawn below zero. 529s sit right above tax-free. */
export const NET_WORTH_LAYERS = ["cash", "taxable", "taxDeferred", "taxFree", "taxFree529", "realAssets"] as const

export type NetWorthLayer = (typeof NET_WORTH_LAYERS)[number]

export const NET_WORTH_LAYER_LABELS: Record<NetWorthLayer | "debt", string> = {
  cash: "Cash",
  taxable: "Taxable",
  taxDeferred: "Tax-deferred",
  taxFree: "Tax-free",
  taxFree529: "Tax-free (529)",
  realAssets: "Property",
  debt: "Debt",
}

export const LAYER_FOR: Record<TaxTreatment, NetWorthLayer> = {
  cash: "cash",
  taxable: "taxable",
  traditional: "taxDeferred",
  roth: "taxFree",
  hsa: "taxFree",
  education: "taxFree529",
}

export type NetWorthPoint = { age: number; year: number; netWorth: number; debt: number } & Record<NetWorthLayer, number>

interface Balances {
  accounts: Record<string, number>
  assets: Record<string, number>
  debts: Record<string, number>
}

/** One point's layers: accounts by tax treatment, homes and other assets at full value, and every debt (negative). */
export function layersFor(doc: PlanDocument, balances: Balances): Record<NetWorthLayer, number> & { debt: number } {
  const layers = { cash: 0, taxable: 0, taxDeferred: 0, taxFree: 0, taxFree529: 0, realAssets: 0, debt: 0 }
  for (const account of doc.accounts) layers[LAYER_FOR[account.taxTreatment]] += balances.accounts[account.id] ?? 0
  for (const asset of doc.assets) layers.realAssets += balances.assets[asset.id] ?? 0
  for (const debt of doc.debts) layers.debt -= balances.debts[debt.id] ?? 0
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
  /** The milestone's id; empty for "money runs out". */
  id: string
  name: string
  kind: MilestoneKind | "payoff" | "depleted"
  icon?: string
  age: number
  year: number
}

/** Milestones (and the year money runs out) positioned by age. */
/** The year each loan is cleared (by its payments, or early when what it's for is sold). */
function payoffMarks(doc: PlanDocument, projection: PlanProjection, age0: number): ChartMilestone[] {
  return loanPayoffs(doc, projection.rows).map(({ debt, row }) => ({
    id: `payoff-${debt.id}`,
    name: payoffName(debt),
    kind: "payoff" as const,
    icon: PAYOFF_ICON,
    age: age0 + row.index,
    year: row.year,
  }))
}

export function chartMilestones(doc: PlanDocument, projection: PlanProjection): ChartMilestone[] {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const ctx = timingContext(doc)
  const marks: ChartMilestone[] = doc.milestones.flatMap((m) => {
    const index = resolveTiming(m.timing, ctx)
    if (index === null || index < 0 || index >= ctx.length) return []
    return [{ id: m.id, name: m.name, kind: m.kind, icon: m.icon, age: age0 + index, year: doc.settings.startYear + index }]
  })
  marks.push(...payoffMarks(doc, projection, age0))
  const depleted = projection.rows.find((r) => r.shortfall > 0.5)
  if (depleted) marks.push({ id: "", name: "Money runs out", kind: "depleted", age: age0 + depleted.index, year: depleted.year })
  return marks
}

/** Money in (above zero) and out (below zero) per year. They balance: in = out. */
export const CASH_IN_LAYERS = ["income", "wdCash", "wdTaxable", "wdTaxDeferred", "wdTaxFree", "wdTaxFree529", "assetSales", "unfunded"] as const
export const CASH_OUT_LAYERS = ["spending", "taxes", "debtPayments", "assetPurchases", "saved"] as const

export type CashFlowLayer = (typeof CASH_IN_LAYERS)[number] | (typeof CASH_OUT_LAYERS)[number]

export const CASH_FLOW_LABELS: Record<CashFlowLayer, string> = {
  income: "Income",
  wdCash: "Withdrawals · cash",
  wdTaxable: "Withdrawals · taxable",
  wdTaxDeferred: "Withdrawals · tax-deferred",
  wdTaxFree: "Withdrawals · tax-free",
  wdTaxFree529: "Withdrawals · tax-free (529)",
  assetSales: "Asset sales",
  unfunded: "Unfunded (money ran out)",
  spending: "Spending",
  taxes: "Taxes",
  debtPayments: "Debt payments",
  assetPurchases: "Asset purchases",
  saved: "Contributions",
}

export const WITHDRAWAL_LAYER: Record<NetWorthLayer, CashFlowLayer | null> = {
  cash: "wdCash",
  taxable: "wdTaxable",
  taxDeferred: "wdTaxDeferred",
  taxFree: "wdTaxFree",
  taxFree529: "wdTaxFree529",
  realAssets: null,
}

export type CashFlowPoint = { age: number; year: number } & Record<CashFlowLayer, number>

/**
 * Cash flow for one year. Employer match is left out on both sides (it never passes through your
 * hands); "saved" (Contributions) is payroll contributions you made plus leftover cash flow deposited.
 * Outflows are negative.
 */
export function cashFlowFor(doc: PlanDocument, row: YearRow, age: number): CashFlowPoint {
  const point: CashFlowPoint = {
    age,
    year: row.year,
    income: row.income,
    wdCash: 0,
    wdTaxable: 0,
    wdTaxDeferred: 0,
    wdTaxFree: 0,
    wdTaxFree529: 0,
    assetSales: Math.max(0, row.assetSales),
    unfunded: row.shortfall,
    spending: -row.expenses,
    taxes: -(row.incomeTax + row.withdrawalTax + row.saleTax + row.tradingTax),
    debtPayments: -row.debtPayments,
    assetPurchases: -(row.assetPurchases + Math.max(0, -row.assetSales)),
    saved: -(row.contributions - row.employerMatch),
  }
  for (const account of doc.accounts) {
    const layer = WITHDRAWAL_LAYER[LAYER_FOR[account.taxTreatment]]
    if (layer) point[layer] += row.withdrawalsBy[account.id] ?? 0
  }
  return point
}

export function cashFlowPoints(doc: PlanDocument, rows: YearRow[]): CashFlowPoint[] {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  return rows.map((r) => cashFlowFor(doc, r, age0 + r.index))
}

export type DebtPoint = { age: number; year: number; owed: number; principal: number; interest: number } & Record<string, number>

/**
 * The Debt view, one point per plan year: what was paid on the loans (positive), as principal and interest in
 * total and per loan (`prin:<id>`, `int:<id>`), plus what's still owed at year end (`owed`, and by debt id).
 */
export function debtPoints(doc: PlanDocument, rows: YearRow[]): DebtPoint[] {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  return rows.map((r) => {
    const point: DebtPoint = { age: age0 + r.index, year: r.year, owed: 0, principal: 0, interest: 0 }
    for (const d of doc.debts) {
      const { principal, interest } = loanSplit(r, d.id)
      point[d.id] = r.debtBalances[d.id] ?? 0
      point[principalKey(d.id)] = principal
      point[interestKey(d.id)] = interest
      point.owed += point[d.id]
      point.principal += principal
      point.interest += interest
    }
    return point
  })
}

/** What a milestone is about, for its color: work life, family, school, money coming in, property, other life changes, or trouble. */
export type MilestoneGroup = "work" | "family" | "education" | "money" | "property" | "life" | "alert"

const GROUP_BY_ICON: Record<string, MilestoneGroup> = {
  beach_access: "work",
  work: "work",
  luggage: "work",
  favorite: "family",
  heart_broken: "family",
  local_florist: "family",
  child_care: "family",
  savings: "education",
  backpack: "education",
  school: "education",
  volunteer_activism: "money",
  redeem: "money",
  home: "property",
  directions_car: "property",
  shopping_bag: "property",
  autorenew: "property",
  sell: "property",
  credit_score: "money",
  elderly: "money",
  account_balance: "money",
}

export function milestoneGroup(m: Pick<ChartMilestone, "kind" | "icon">): MilestoneGroup {
  if (m.kind === "depleted") return "alert"
  if (m.kind === "retirement") return "work"
  if (m.kind === "payoff") return "money"
  const byIcon = m.icon ? GROUP_BY_ICON[m.icon] : undefined
  if (m.kind === "child") return byIcon === "education" ? "education" : "family"
  return byIcon ?? (m.kind === "asset" ? "property" : "life")
}
