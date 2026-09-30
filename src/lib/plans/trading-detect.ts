import type { PlanAccount, PlanDocument } from "./plan-types"

/** A buy or sell from a brokerage account's history. Sells may carry negative quantity/amount (Plaid). */
export interface TradeRow {
  date: Date
  type: "buy" | "sell"
  quantity: number
  amount: number
  securityId: string | null
}

export interface TradingSuggestion {
  realizedShare: number
  /** Null when no sale could be matched to a purchase, so the holding period is unknown. */
  shortTermShare: number | null
}

/** What an account's trade history shows, and the plan settings it points to. */
export interface TradingActivity {
  trades: number
  spanDays: number
  /** Sale proceeds per year as a multiple of the current balance. */
  turnover: number
  medianHoldDays: number | null
  /** Share of matched sale proceeds from positions held a year or less. */
  shortTermShare: number | null
  /** Null when the account doesn't look actively traded. */
  suggestion: TradingSuggestion | null
}

/** Fewer trades than this, or less turnover, reads as buy and hold. */
const MIN_TRADES = 10
const MIN_TURNOVER = 0.5
/** Short histories are annualized over at least this long, so a busy week doesn't look like a busy year. */
const MIN_SPAN_DAYS = 90
const DAYS_PER_YEAR = 365
const MS_PER_DAY = 86_400_000
/** Suggestions are rounded to this step (5%). */
const STEP = 0.05
const EPSILON = 1e-9

interface Lot {
  quantity: number
  date: Date
}

interface Matched {
  holdDays: number[]
  shortProceeds: number
  matchedProceeds: number
  soldProceeds: number
}

const roundStep = (value: number) => Math.round(value / STEP) * STEP

/** Sells matched to the oldest open buys of the same security (first in, first out). */
function matchLots(trades: TradeRow[]): Matched {
  const lots = new Map<string, Lot[]>()
  const out: Matched = { holdDays: [], shortProceeds: 0, matchedProceeds: 0, soldProceeds: 0 }
  const sorted = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.type === "buy" ? -1 : 1))
  for (const t of sorted) {
    const key = t.securityId ?? ""
    const quantity = Math.abs(t.quantity)
    if (t.type === "buy") {
      lots.set(key, [...(lots.get(key) ?? []), { quantity, date: t.date }])
      continue
    }
    const proceeds = Math.abs(t.amount)
    out.soldProceeds += proceeds
    const perShare = quantity > 0 ? proceeds / quantity : 0
    let left = quantity
    const open = [...(lots.get(key) ?? [])]
    while (left > EPSILON && open.length > 0) {
      const lot = open[0]
      const take = Math.min(left, lot.quantity)
      const days = (t.date.getTime() - lot.date.getTime()) / MS_PER_DAY
      out.holdDays.push(days)
      out.matchedProceeds += take * perShare
      if (days <= DAYS_PER_YEAR) out.shortProceeds += take * perShare
      left -= take
      open[0] = { ...lot, quantity: lot.quantity - take }
      if (open[0].quantity <= EPSILON) open.shift()
    }
    lots.set(key, open)
  }
  return out
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Turnover and holding periods from a brokerage account's trades, with suggested plan settings. */
export function detectTrading(trades: TradeRow[], balance: number): TradingActivity {
  const times = trades.map((t) => t.date.getTime())
  const spanDays = trades.length ? (Math.max(...times) - Math.min(...times)) / MS_PER_DAY : 0
  const matched = matchLots(trades)
  const years = Math.max(spanDays, MIN_SPAN_DAYS) / DAYS_PER_YEAR
  const turnover = balance > 0 ? matched.soldProceeds / balance / years : 0
  const shortTermShare = matched.matchedProceeds > 0 ? matched.shortProceeds / matched.matchedProceeds : null
  const active = trades.length >= MIN_TRADES && turnover >= MIN_TURNOVER
  return {
    trades: trades.length,
    spanDays,
    turnover,
    medianHoldDays: median(matched.holdDays),
    shortTermShare,
    suggestion: active
      ? { realizedShare: Math.min(1, roundStep(turnover)), shortTermShare: shortTermShare === null ? null : roundStep(shortTermShare) }
      : null,
  }
}

/** The finance account a plan account was imported from, if any. */
function linkedId(account: PlanAccount): string | null {
  return account.source?.kind === "finance-account" ? account.source.refId : null
}

/** Pre-fills detected trading on taxable accounts (used when importing a plan). */
export function withDetectedTrading(accounts: PlanAccount[], activity: Record<string, TradingActivity>): PlanAccount[] {
  return accounts.map((a) => {
    const id = linkedId(a)
    const s = id && a.taxTreatment === "taxable" ? activity[id]?.suggestion : null
    return s ? applySuggestion(a, s) : a
  })
}

function applySuggestion(account: PlanAccount, s: TradingSuggestion): PlanAccount {
  return { ...account, realizedShare: s.realizedShare, shortTermShare: s.shortTermShare ?? account.shortTermShare }
}

export interface PendingSuggestion {
  account: PlanAccount
  activity: TradingActivity
  suggestion: TradingSuggestion
}

/** Taxable linked accounts whose trading settings differ from what their history suggests. */
export function pendingSuggestions(doc: PlanDocument, activity: Record<string, TradingActivity>): PendingSuggestion[] {
  return doc.accounts.flatMap((account) => {
    const id = linkedId(account)
    const found = id && account.taxTreatment === "taxable" ? activity[id] : undefined
    const suggestion = found?.suggestion
    if (!found || !suggestion) return []
    const sameRealized = Math.abs((account.realizedShare ?? 0) - suggestion.realizedShare) < STEP / 2
    const sameShort = suggestion.shortTermShare === null || Math.abs((account.shortTermShare ?? 0) - suggestion.shortTermShare) < STEP / 2
    return sameRealized && sameShort ? [] : [{ account, activity: found, suggestion }]
  })
}

/** Applies a detected suggestion to one plan account. */
export function applyTradingSuggestion(doc: PlanDocument, accountId: string, s: TradingSuggestion): PlanDocument {
  return { ...doc, accounts: doc.accounts.map((a) => (a.id === accountId ? applySuggestion(a, s) : a)) }
}
