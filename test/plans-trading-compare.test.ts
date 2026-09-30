import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { breakEvenEdge, compareTrading, tradingOutcome, withTradingSleeve } from "@/lib/plans/plan-trading-compare"
import type { PlanAccount, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

const trader: PlanAccount = {
  id: "brk", name: "Brokerage", taxTreatment: "taxable", balance: 1_000_000, costBasis: 1_000_000, returnRate: 0.08,
  owner: null, source: null, realizedShare: 1, shortTermShare: 1,
}

function plan(accounts: PlanAccount[] = [trader]): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0.03, incomeTaxRate: 0.35, capitalGainsRate: 0.15, cashBuffer: 0, endAge: 70 },
    accounts,
    expenses: [{ id: "e", name: "Living", category: null, amount: 30_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    cashFlow: { ...base.cashFlow, withdrawalOrder: ["brk"] },
  }
}

test("sleeves split the balance and cost basis, and only the traded part earns the edge and realizes gains", () => {
  const split = withTradingSleeve(plan(), 0.1, 0.2).accounts
  close(split.reduce((s, a) => s + a.balance, 0), 1_000_000)
  const held = split.find((a) => a.id === "brk")!
  const traded = split.find((a) => a.id !== "brk")!
  assert.deepEqual([held.balance, held.costBasis, held.realizedShare, held.returnRate], [800_000, 800_000, 0, 0.08])
  assert.deepEqual([traded.balance, traded.realizedShare], [200_000, 1])
  close(traded.returnRate, 0.18, 1e-9)
  assert.deepEqual(withTradingSleeve(plan(), 0.1, 0.2).cashFlow.withdrawalOrder, [traded.id, "brk"])
})

test("buy and hold ignores the edge; trading all of it keeps the account's id", () => {
  const hold = withTradingSleeve(plan(), 0.5, 0).accounts
  assert.deepEqual(hold.map((a) => [a.id, a.returnRate, a.realizedShare]), [["brk", 0.08, 0]])
  const all = withTradingSleeve(plan(), 0.05, 1).accounts
  assert.equal(all.length, 1)
  assert.equal(all[0].id, "brk")
})

test("with no edge, trading loses to buy and hold because gains are taxed every year", () => {
  const trade = tradingOutcome(withTradingSleeve(plan(), 0, 1))
  const hold = tradingOutcome(withTradingSleeve(plan(), 0, 0))
  assert.ok(trade.endWealth < hold.endWealth, `${trade.endWealth} < ${hold.endWealth}`)
  assert.ok(trade.lifetimeTax > hold.lifetimeTax)
})

test("break-even: trading everything at that edge ends level with buy and hold", () => {
  const edge = breakEvenEdge(plan())!
  assert.ok(edge > 0 && edge < 0.1, `edge ${edge}`)
  const hold = tradingOutcome(withTradingSleeve(plan(), 0, 0)).endWealth
  close(tradingOutcome(withTradingSleeve(plan(), edge, 1)).endWealth / hold, 1, 0.001)
})

test("compareTrading: a bigger edge never ends with less; nothing to compare without traded accounts", () => {
  const result = compareTrading(plan(), 0.07, 10)!
  assert.ok(result.edges.includes(0.07))
  for (let j = 0; j < result.sleeves.length; j++) {
    for (let i = 1; i < result.edges.length; i++) {
      assert.ok(result.outcomes[i][j].endWealth >= result.outcomes[i - 1][j].endWealth - 1e-6)
    }
  }
  assert.equal(compareTrading(plan([{ ...trader, realizedShare: 0 }])), null)
})
