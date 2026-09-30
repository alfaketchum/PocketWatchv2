import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import {
  applyTradingSuggestion,
  detectTrading,
  pendingSuggestions,
  withDetectedTrading,
  type TradeRow,
  type TradingActivity,
} from "@/lib/plans/trading-detect"
import type { PlanAccount } from "@/lib/plans/plan-types"

const day = (n: number) => new Date(Date.UTC(2025, 0, 1) + n * 86_400_000)
const buy = (n: number, quantity: number, price: number, securityId = "s1"): TradeRow => ({ date: day(n), type: "buy", quantity, amount: quantity * price, securityId })
// Plaid reports sells with negative quantity and amount.
const sell = (n: number, quantity: number, price: number, securityId = "s1"): TradeRow => ({ date: day(n), type: "sell", quantity: -quantity, amount: -quantity * price, securityId })

/** `count` round trips a week apart, each bought and sold `hold` days later. */
function roundTrips(count: number, hold: number, value: number): TradeRow[] {
  return Array.from({ length: count }, (_, i) => [buy(i * 7, 100, value / 100), sell(i * 7 + hold, 100, value / 100)]).flat()
}

test("a day trader: high turnover, short holds → trade it all, all short-term", () => {
  const a = detectTrading(roundTrips(50, 2, 50_000), 100_000)
  assert.equal(a.trades, 100)
  assert.ok(a.turnover > 5, `turnover ${a.turnover}`)
  assert.equal(a.medianHoldDays, 2)
  assert.deepEqual(a.suggestion, { realizedShare: 1, shortTermShare: 1 })
})

test("buy and hold: monthly buys and no sales, or too few trades, suggest nothing", () => {
  const dca = Array.from({ length: 24 }, (_, i) => buy(i * 30, 10, 100))
  assert.equal(detectTrading(dca, 50_000).suggestion, null)
  assert.equal(detectTrading(roundTrips(4, 2, 50_000), 10_000).suggestion, null)
})

test("positions held over a year count as long-term; turnover sets the share sold", () => {
  const trades = [...Array.from({ length: 10 }, (_, i) => buy(i, 100, 100, `s${i}`)), ...Array.from({ length: 10 }, (_, i) => sell(400 + i, 100, 120, `s${i}`))]
  const a = detectTrading(trades, 200_000)
  assert.equal(a.shortTermShare, 0)
  // $120k sold over ~409 days on a $200k balance ≈ 0.54×/yr → 55%.
  assert.equal(a.suggestion?.realizedShare, 0.55)
  assert.equal(a.suggestion?.shortTermShare, 0)
})

test("sales are matched to the oldest shares first", () => {
  const trades = [buy(0, 100, 10), buy(300, 100, 10), sell(420, 150, 10), ...roundTrips(5, 1, 1_000).map((t) => ({ ...t, securityId: "s2" }))]
  const a = detectTrading(trades, 1_000)
  // Of the 150 sold on day 420: 100 from day 0 (long) and 50 from day 300 (short).
  const main = (1_500 - 1_000) / 1_500
  assert.ok(a.shortTermShare !== null && a.shortTermShare > main, `${a.shortTermShare}`)
})

test("sales of shares bought before the history leave the holding period unknown", () => {
  const trades = Array.from({ length: 12 }, (_, i) => sell(i * 7, 10, 100))
  const a = detectTrading(trades, 5_000)
  assert.equal(a.shortTermShare, null)
  assert.equal(a.medianHoldDays, null)
  assert.deepEqual(a.suggestion, { realizedShare: 1, shortTermShare: null })
})

const acct = (id: string, taxTreatment: PlanAccount["taxTreatment"], refId: string | null, extra: Partial<PlanAccount> = {}): PlanAccount => ({
  id, name: id, taxTreatment, balance: 100_000, costBasis: null, returnRate: 0.07, owner: null,
  source: refId ? { kind: "finance-account", refId } : null, ...extra,
})
const active: TradingActivity = { trades: 200, spanDays: 365, turnover: 12, medianHoldDays: 3, shortTermShare: 1, suggestion: { realizedShare: 1, shortTermShare: 1 } }

test("import pre-fills only taxable linked accounts", () => {
  const out = withDetectedTrading([acct("brk", "taxable", "f1"), acct("ira", "traditional", "f1"), acct("manual", "taxable", null)], { f1: active })
  assert.deepEqual(out.map((a) => [a.realizedShare, a.shortTermShare]), [[1, 1], [undefined, undefined], [undefined, undefined]])
})

test("suggestions list only accounts whose settings differ, and applying one clears it", () => {
  const doc = { ...blankPlanDocument(new Date(2026, 0, 1)), accounts: [acct("brk", "taxable", "f1"), acct("done", "taxable", "f2", { realizedShare: 1, shortTermShare: 1 })] }
  const pending = pendingSuggestions(doc, { f1: active, f2: active })
  assert.deepEqual(pending.map((p) => p.account.id), ["brk"])
  const applied = applyTradingSuggestion(doc, "brk", pending[0].suggestion)
  assert.equal(pendingSuggestions(applied, { f1: active, f2: active }).length, 0)
  // An unknown short-term share keeps what the account already had.
  const keep = applyTradingSuggestion({ ...doc, accounts: [acct("brk", "taxable", "f1", { shortTermShare: 0.4 })] }, "brk", { realizedShare: 1, shortTermShare: null })
  assert.equal(keep.accounts[0].shortTermShare, 0.4)
})
