import { loanPayments } from "./plan-loan-parts"
import { cashFlowFor, CASH_FLOW_LABELS, type CashFlowLayer } from "./plan-chart"
import type { PlanDocument, YearRow } from "./plan-types"
import { TAX_PARTS } from "./plan-row-taxes"

/** Flows smaller than this (dollars) are left out so the diagram stays readable. */
const MIN_FLOW = 0.5

export type SankeyGroup = CashFlowLayer | "hub"

export interface SankeyNodeDatum {
  name: string
  group: SankeyGroup
  /** 0 sources, 1 cash flow, 2 uses, 3 details. */
  column: number
}

export interface SankeyLinkDatum {
  source: number
  target: number
  value: number
}

export interface PlanSankey {
  nodes: SankeyNodeDatum[]
  links: SankeyLinkDatum[]
  /** Everything that flowed through the year (= money in = money out). */
  total: number
}

const EXTRA_SOURCES = ["assetSales", "borrowed", "unfunded"] as const
const OUT_GROUPS = ["taxes", "spending", "debtPayments", "assetPurchases", "saved"] as const

class Builder {
  nodes: SankeyNodeDatum[] = []
  links: SankeyLinkDatum[] = []

  node(name: string, group: SankeyGroup, column: number): number {
    this.nodes.push({ name, group, column })
    return this.nodes.length - 1
  }

  link(source: number, target: number, value: number) {
    if (value >= MIN_FLOW) this.links.push({ source, target, value })
  }
}

function withdrawalGroup(doc: PlanDocument, accountId: string): CashFlowLayer {
  const treatment = doc.accounts.find((a) => a.id === accountId)?.taxTreatment
  if (treatment === "cash") return "wdCash"
  if (treatment === "taxable") return "wdTaxable"
  if (treatment === "traditional") return "wdTaxDeferred"
  return treatment === "education" ? "wdTaxFree529" : "wdTaxFree"
}

/** Where money came from, as sources feeding the hub. */
function addSources(b: Builder, doc: PlanDocument, row: YearRow, hub: number, flow: ReturnType<typeof cashFlowFor>) {
  for (const income of doc.incomes) {
    const value = row.incomeBy[income.id] ?? 0
    if (value >= MIN_FLOW) b.link(b.node(income.name, "income", 0), hub, value)
  }
  for (const account of doc.accounts) {
    const value = row.withdrawalsBy[account.id] ?? 0
    if (value >= MIN_FLOW) b.link(b.node(`From ${account.name}`, withdrawalGroup(doc, account.id), 0), hub, value)
  }
  for (const group of EXTRA_SOURCES) {
    if (flow[group] >= MIN_FLOW) b.link(b.node(CASH_FLOW_LABELS[group], group, 0), hub, flow[group])
  }
}

/** Detail leaves under each use of money (expense lines, accounts, kinds of tax). */
function detailsFor(group: (typeof OUT_GROUPS)[number], doc: PlanDocument, row: YearRow): { name: string; value: number }[] {
  if (group === "spending") return doc.expenses.map((e) => ({ name: e.name, value: row.expensesBy[e.id] ?? 0 }))
  if (group === "saved") {
    return doc.accounts.map((a) => ({
      name: a.name,
      value: (row.contributionsBy[a.id] ?? 0) - (row.employerMatchBy[a.id] ?? 0),
    }))
  }
  if (group === "taxes") {
    return TAX_PARTS.map((t) => ({ name: t.label, value: row[t.field] }))
  }
  if (group === "debtPayments") {
    return loanPayments(doc, row).flatMap((l) => [
      { name: `${l.name} principal`, value: l.principal },
      { name: `${l.name} interest`, value: l.interest },
    ])
  }
  return []
}

/**
 * One plan year as a Sankey: income streams, withdrawals by account, asset sales and any unfunded
 * gap flow into "Cash flow", which splits into taxes, spending, debt, purchases and contributions,
 * each fanning out to its lines. Employer match is left out (it never passes through your hands).
 */
export function planSankey(doc: PlanDocument, row: YearRow, age: number): PlanSankey {
  const b = new Builder()
  const flow = cashFlowFor(doc, row, age)
  const hub = b.node("Cash flow", "hub", 1)
  addSources(b, doc, row, hub, flow)
  for (const group of OUT_GROUPS) {
    const value = -flow[group]
    if (value < MIN_FLOW) continue
    const node = b.node(CASH_FLOW_LABELS[group], group, 2)
    b.link(hub, node, value)
    const details = detailsFor(group, doc, row).filter((d) => d.value >= MIN_FLOW)
    // A single detail line would just repeat its parent.
    if (details.length > 1) details.forEach((d) => b.link(node, b.node(d.name, group, 3), d.value))
  }
  const total = b.links.filter((l) => l.target === hub).reduce((s, l) => s + l.value, 0)
  return { nodes: b.nodes, links: b.links, total }
}
