import { interestKey, loanSplit, principalKey } from "./plan-loan-parts"
import {
  CASH_IN_LAYERS,
  CASH_OUT_LAYERS,
  LAYER_FOR,
  NET_WORTH_LAYERS,
  netWorthPoints,
  WITHDRAWAL_LAYER,
  type CashFlowLayer,
  type NetWorthLayer,
} from "./plan-chart"
import { ASSET_COSTS_CATEGORY } from "./plan-asset-costs"
import { ageAtStart } from "./plan-timing"
import type { PlanDocument, YearRow } from "./plan-types"

/** One subcategory band: an account, asset, loan, income, spending line… inside its parent band. */
export interface DetailSeries {
  key: string
  label: string
  parent: NetWorthLayer | "debt" | CashFlowLayer
}

export type DetailRow = { age: number; year: number } & Record<string, number>

const TAX_PARTS = [
  { key: "tax:income", label: "Income tax", field: "incomeTax" },
  { key: "tax:payroll", label: "Payroll tax", field: "payrollTax" },
  { key: "tax:withdrawal", label: "Tax on withdrawals", field: "withdrawalTax" },
  { key: "tax:sale", label: "Tax on asset sales", field: "saleTax" },
  { key: "tax:trading", label: "Tax on trading gains", field: "tradingTax" },
] as const

/** Parents in stack order, each followed by its biggest subcategory first (it sits nearest the parent's base). */
function ordered(series: DetailSeries[], parents: readonly string[], rows: DetailRow[]): DetailSeries[] {
  const peak = (key: string) => Math.max(0, ...rows.map((r) => Math.abs(r[key] ?? 0)))
  return parents.flatMap((p) => series.filter((s) => s.parent === p).sort((a, b) => peak(b.key) - peak(a.key)))
}

/** Net worth by account, asset and loan (loans negative), with each year's net worth. */
export function netWorthDetail(doc: PlanDocument, rows: YearRow[]): { series: DetailSeries[]; points: DetailRow[] } {
  const totals = netWorthPoints(doc, rows)
  const points = rows.map((r, i) => {
    const row: DetailRow = { age: totals[i].age, year: r.year, netWorth: totals[i].netWorth }
    for (const a of doc.accounts) row[`a:${a.id}`] = r.balances[a.id] ?? 0
    for (const a of doc.assets) row[`p:${a.id}`] = r.assetValues[a.id] ?? 0
    for (const d of doc.debts) row[`d:${d.id}`] = -(r.debtBalances[d.id] ?? 0)
    return row
  })
  const series: DetailSeries[] = [
    ...doc.accounts.map((a) => ({ key: `a:${a.id}`, label: a.name, parent: LAYER_FOR[a.taxTreatment] })),
    ...doc.assets.map((a) => ({ key: `p:${a.id}`, label: a.name, parent: "realAssets" as const })),
    ...doc.debts.map((d) => ({ key: `d:${d.id}`, label: d.name, parent: "debt" as const })),
  ]
  return { series: ordered(series, [...NET_WORTH_LAYERS, "debt"], points), points }
}

/** Cash flow by income, account, spending line and kind of tax; sums to the grouped view every year. */
export function cashFlowDetail(doc: PlanDocument, rows: YearRow[]): { series: DetailSeries[]; points: DetailRow[] } {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const points = rows.map((r) => {
    const row: DetailRow = {
      age: age0 + r.index,
      year: r.year,
      assetSales: Math.max(0, r.assetSales),
      borrowed: r.borrowed,
      unfunded: r.shortfall,
      assetPurchases: -(r.assetPurchases + Math.max(0, -r.assetSales)),
    }
    for (const i of doc.incomes) row[`in:${i.id}`] = r.incomeBy[i.id] ?? 0
    for (const a of doc.accounts) {
      row[`wd:${a.id}`] = r.withdrawalsBy[a.id] ?? 0
      row[`sv:${a.id}`] = -((r.contributionsBy[a.id] ?? 0) - (r.employerMatchBy[a.id] ?? 0))
    }
    for (const e of doc.expenses) row[`sp:${e.id}`] = -(r.expensesBy[e.id] ?? 0)
    for (const t of TAX_PARTS) row[t.key] = -r[t.field]
    for (const d of doc.debts) {
      const { principal, interest } = loanSplit(r, d.id)
      row[principalKey(d.id)] = -principal
      row[interestKey(d.id)] = -interest
    }
    return row
  })
  const withdrawalParent = (id: string) => {
    const account = doc.accounts.find((a) => a.id === id)
    return (account && WITHDRAWAL_LAYER[LAYER_FOR[account.taxTreatment]]) || "wdCash"
  }
  const series: DetailSeries[] = [
    ...doc.incomes.map((i) => ({ key: `in:${i.id}`, label: i.name, parent: "income" as const })),
    ...doc.accounts.map((a) => ({ key: `wd:${a.id}`, label: `From ${a.name}`, parent: withdrawalParent(a.id) })),
    { key: "assetSales", label: "Asset sales", parent: "assetSales" },
    { key: "borrowed", label: "Borrowed", parent: "borrowed" },
    { key: "unfunded", label: "Unfunded (money ran out)", parent: "unfunded" },
    ...doc.expenses.map((e) => ({ key: `sp:${e.id}`, label: e.name, parent: "spending" as const })),
    ...TAX_PARTS.map((t) => ({ key: t.key, label: t.label, parent: "taxes" as const })),
    ...loanSeries(doc, "debtPayments" as const),
    { key: "assetPurchases", label: "Asset purchases", parent: "assetPurchases" },
    ...doc.accounts.map((a) => ({ key: `sv:${a.id}`, label: `Into ${a.name}`, parent: "saved" as const })),
  ]
  return { series: ordered(series, [...CASH_IN_LAYERS, ...CASH_OUT_LAYERS], points), points }
}

/** Each loan's payments as two series, principal then interest, under `parent`. */
function loanSeries<P extends string>(doc: PlanDocument, parent: P) {
  return doc.debts.flatMap((d) => [
    { key: principalKey(d.id), label: `${d.name} · principal`, parent },
    { key: interestKey(d.id), label: `${d.name} · interest`, parent },
  ])
}

/** Groups in the Expenses view: everyday living, kids, owning a home or car, taxes and debt payments. */
export const EXPENSE_GROUPS = ["living", "kids", "property", "taxes", "debt"] as const
export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number]

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  living: "Living",
  kids: "Kids",
  property: "Home & vehicle costs",
  taxes: "Taxes",
  debt: "Debt payments",
}

const groupOfExpense = (category: string | null): ExpenseGroup =>
  category === "Kids" ? "kids" : category === ASSET_COSTS_CATEGORY ? "property" : "living"

/**
 * Everything spent each year (positive): spending lines, taxes and debt payments. Grouped, or with
 * `detail` each spending line and kind of tax; the groups add up to the same total either way.
 */
export function expensesView(doc: PlanDocument, rows: YearRow[], detail: boolean): { series: (DetailSeries & { group: ExpenseGroup })[]; points: DetailRow[] } {
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const points = rows.map((r) => {
    const row: DetailRow = { age: age0 + r.index, year: r.year, debt: r.debtPayments }
    let spent = r.debtPayments
    for (const d of doc.debts) {
      const { principal, interest } = loanSplit(r, d.id)
      row[principalKey(d.id)] = principal
      row[interestKey(d.id)] = interest
    }
    for (const g of ["living", "kids", "property", "taxes"] as const) row[g] = 0
    for (const e of doc.expenses) {
      const v = r.expensesBy[e.id] ?? 0
      row[`sp:${e.id}`] = v
      row[groupOfExpense(e.category)] += v
      spent += v
    }
    for (const t of TAX_PARTS) {
      row[t.key] = r[t.field]
      row.taxes += r[t.field]
      spent += r[t.field]
    }
    row.spent = spent
    return row
  })
  const peak = (key: string) => Math.max(0, ...points.map((p) => p[key] ?? 0))
  if (!detail) {
    return { series: EXPENSE_GROUPS.map((g) => ({ key: g, label: EXPENSE_GROUP_LABELS[g], parent: "spending", group: g })), points }
  }
  const lines = doc.expenses
    .map((e) => ({ key: `sp:${e.id}`, label: e.name, parent: "spending" as const, group: groupOfExpense(e.category) }))
    .sort((a, b) => EXPENSE_GROUPS.indexOf(a.group) - EXPENSE_GROUPS.indexOf(b.group) || peak(b.key) - peak(a.key))
  const taxes = TAX_PARTS.map((t) => ({ key: t.key, label: t.label, parent: "taxes" as const, group: "taxes" as const }))
  const loans = loanSeries(doc, "debtPayments" as const).map((l) => ({ ...l, group: "debt" as const }))
  return { series: [...lines, ...taxes, ...loans], points }
}
