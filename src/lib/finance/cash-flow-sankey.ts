export interface SankeyMonth {
  month: string
  income: number
  spending: number
  categories?: Record<string, number>
}

export interface CashFlowSankey {
  nodes: { name: string; kind: "source" | "hub" | "spend" | "saved" }[]
  links: { source: number; target: number; value: number }[]
  monthlyIncome: number
  monthlySpend: number
  months: number
}

const TOP_CATEGORIES = 7

/**
 * Average monthly cash flow over complete months: income (or the user's override) → spending
 * categories + saved. When spending exceeds income, the shortfall is shown as "From savings".
 */
export function buildCashFlowSankey(months: SankeyMonth[], currentMonth: string, monthlyIncomeOverride: number | null): CashFlowSankey | null {
  const complete = months.filter((m) => m.month < currentMonth && m.spending > 0)
  if (complete.length === 0) return null
  const n = complete.length
  const totals = new Map<string, number>()
  for (const m of complete) {
    for (const [cat, amt] of Object.entries(m.categories ?? {})) totals.set(cat, (totals.get(cat) ?? 0) + amt / n)
  }
  const cats = [...totals].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const top = cats.slice(0, TOP_CATEGORIES)
  const other = cats.slice(TOP_CATEGORIES).reduce((s, [, v]) => s + v, 0)
  const spendRows = other > 0 ? [...top, ["Other", other] as [string, number]] : top
  const spend = spendRows.reduce((s, [, v]) => s + v, 0)
  const income = monthlyIncomeOverride ?? complete.reduce((s, m) => s + m.income, 0) / n

  const nodes: CashFlowSankey["nodes"] = [{ name: "Income", kind: "source" }]
  const links: CashFlowSankey["links"] = []
  const shortfall = Math.max(0, spend - income)
  if (shortfall > 0) {
    nodes.push({ name: "From savings", kind: "source" })
  }
  const hub = nodes.length
  nodes.push({ name: "Money in", kind: "hub" })
  if (income > 0) links.push({ source: 0, target: hub, value: income })
  if (shortfall > 0) links.push({ source: 1, target: hub, value: shortfall })
  for (const [name, value] of spendRows) {
    links.push({ source: hub, target: nodes.length, value })
    nodes.push({ name, kind: "spend" })
  }
  const saved = income - spend
  if (saved > 0) {
    links.push({ source: hub, target: nodes.length, value: saved })
    nodes.push({ name: "Saved & invested", kind: "saved" })
  }
  return { nodes, links, monthlyIncome: income, monthlySpend: spend, months: n }
}
