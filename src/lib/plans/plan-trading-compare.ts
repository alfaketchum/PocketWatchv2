import { simulatePlan } from "./engine/simulate"
import { deflator } from "./plan-dollars"
import type { PlanAccount, PlanDocument } from "./plan-types"

/** Extra return per year from trading, before tax, over the account's buy-and-hold return. */
export const TRADING_EDGES = [0, 0.02, 0.05, 0.1, 0.2, 0.5] as const
/** Share of each trading account kept in the actively traded sleeve (0 = buy and hold). */
export const TRADING_SLEEVES = [1, 0.5, 0.2, 0] as const

const BREAK_EVEN_MAX_EDGE = 2
const BREAK_EVEN_STEPS = 30
const TRADE_SUFFIX = "~trading"

export interface TradingOutcome {
  /** Accounts at the plan's end, today's dollars. */
  endWealth: number
  /** Taxes over the whole plan, today's dollars. */
  lifetimeTax: number
  /** Age the money first runs short, or null if it never does. */
  runsOutAge: number | null
}

export interface TradingComparison {
  edges: number[]
  sleeves: number[]
  /** outcomes[edge][sleeve], in the order of `edges` and `sleeves`. */
  outcomes: TradingOutcome[][]
  /** Smallest edge at which trading all of it ends with as much as buy and hold; null if none up to 200%. */
  breakEvenEdge: number | null
}

/** Taxable accounts the plan marks as actively traded. */
export function tradingAccounts(doc: PlanDocument): PlanAccount[] {
  return doc.accounts.filter((a) => a.taxTreatment === "taxable" && (a.realizedShare ?? 0) > 0)
}

/**
 * Splits each trading account into a traded sleeve (`sleeve` of the balance, earning `edge` more and
 * realizing gains as set) and a held part under the original id (buy and hold, the account's own return).
 */
export function withTradingSleeve(doc: PlanDocument, edge: number, sleeve: number): PlanDocument {
  const traded = new Set(tradingAccounts(doc).map((a) => a.id))
  const accounts = doc.accounts.flatMap((a): PlanAccount[] => {
    if (!traded.has(a.id)) return [a]
    const part = (share: number) => ({ balance: a.balance * share, costBasis: a.costBasis === null ? null : a.costBasis * share })
    const held: PlanAccount = { ...a, ...part(1 - sleeve), realizedShare: 0 }
    const trading: PlanAccount = { ...a, ...part(sleeve), id: `${a.id}${TRADE_SUFFIX}`, name: `${a.name} (trading)`, returnRate: a.returnRate + edge }
    return sleeve <= 0 ? [held] : sleeve >= 1 ? [{ ...trading, id: a.id, name: a.name }] : [held, trading]
  })
  if (sleeve <= 0 || sleeve >= 1) return { ...doc, accounts }
  // Spend from the traded sleeve just before its held part: its gains are already taxed.
  const withdrawalOrder = doc.cashFlow.withdrawalOrder.flatMap((id) => (traded.has(id) ? [`${id}${TRADE_SUFFIX}`, id] : [id]))
  return { ...doc, accounts, cashFlow: { ...doc.cashFlow, withdrawalOrder } }
}

/** Plan years up to `years` from the start (the whole plan when null). */
function simulateFor(doc: PlanDocument, years: number | null) {
  const { rows } = simulatePlan(doc)
  return years === null ? rows : rows.slice(0, years)
}

export function tradingOutcome(doc: PlanDocument, years: number | null = null): TradingOutcome {
  const rows = simulateFor(doc, years)
  const inflation = doc.settings.inflation
  const last = rows[rows.length - 1]
  const short = rows.find((r) => r.shortfall > 0)
  return {
    endWealth: last ? last.accountsTotal / deflator(inflation, last.index, "balance") : 0,
    lifetimeTax: rows.reduce(
      (s, r) => s + (r.incomeTax + r.withdrawalTax + r.saleTax + r.tradingTax) / deflator(inflation, r.index, "flow"),
      0,
    ),
    runsOutAge: short ? (short.ages[0] ?? null) : null,
  }
}

/** Ending wealth net of any unfunded spending, so plans that run out still rank below ones that don't. */
function score(doc: PlanDocument, years: number | null): number {
  const rows = simulateFor(doc, years)
  const inflation = doc.settings.inflation
  const last = rows[rows.length - 1]
  const unfunded = rows.reduce((s, r) => s + r.shortfall / deflator(inflation, r.index, "flow"), 0)
  return (last ? last.accountsTotal / deflator(inflation, last.index, "balance") : 0) - unfunded
}

/** Bisects for the edge where trading all of it matches buy and hold. */
export function breakEvenEdge(doc: PlanDocument, years: number | null = null): number | null {
  const hold = score(withTradingSleeve(doc, 0, 0), years)
  const beats = (edge: number) => score(withTradingSleeve(doc, edge, 1), years) >= hold
  if (beats(0)) return 0
  if (!beats(BREAK_EVEN_MAX_EDGE)) return null
  let lo = 0
  let hi = BREAK_EVEN_MAX_EDGE
  for (let i = 0; i < BREAK_EVEN_STEPS; i++) {
    const mid = (lo + hi) / 2
    if (beats(mid)) hi = mid
    else lo = mid
  }
  return hi
}

/** Every edge × sleeve combination over `years` (whole plan when null), plus the break-even edge. Null when nothing is traded. */
export function compareTrading(doc: PlanDocument, extraEdge: number | null = null, years: number | null = null): TradingComparison | null {
  if (tradingAccounts(doc).length === 0) return null
  const edges = [...new Set([...TRADING_EDGES, ...(extraEdge === null ? [] : [extraEdge])])].sort((a, b) => a - b)
  const sleeves = [...TRADING_SLEEVES]
  return {
    edges,
    sleeves,
    outcomes: edges.map((edge) => sleeves.map((sleeve) => tradingOutcome(withTradingSleeve(doc, edge, sleeve), years))),
    breakEvenEdge: breakEvenEdge(doc, years),
  }
}
