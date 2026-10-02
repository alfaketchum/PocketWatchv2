import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { applyEquity, initialEquityDraft, NEW_STOCK_ACCOUNT } from "@/components/plans/editor/equity-helpers"
import { expectedCallPayoff, normalCdf } from "@/lib/plans/engine/engine-equity"
import { equityYearReturn } from "@/lib/plans/stress/stress-mix"
import type { PlanAccount, PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)

function assertClose(actual: number, expected: number, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) < tolerance, `Expected ${actual} ≈ ${expected}`)
}

function account(id: string, taxTreatment: PlanAccount["taxTreatment"]): PlanAccount {
  return { id, name: id, taxTreatment, balance: 0, costBasis: null, returnRate: 0, owner: null, source: null }
}

function income(id: string, kind: PlanIncome["kind"], amount: number, extra: Partial<PlanIncome> = {}): PlanIncome {
  return {
    id,
    name: id,
    kind,
    amount,
    growth: 0,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    taxable: true,
    oneTime: false,
    contributions: [],
    ...extra,
  }
}

function doc(patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0.2, capitalGainsRate: 0, cashBuffer: 0, endAge: 45 },
    accounts: [account("cash", "cash"), account("stock", "taxable")],
    // Leftover cash stays in cash, so the stock account shows only what pay put there.
    cashFlow: { surplusOrder: [{ accountId: "cash", annualCap: null }], withdrawalOrder: [] },
    ...patch,
  }
}

test("equity pay is taxed as wages and kept shares land in the stock account at full basis", () => {
  const d = doc({
    incomes: [income("rsu", "equity", 40_000, { contributions: [{ id: "c", accountId: "stock", percent: 0.5, employerMatchPercent: 0, preTax: false }] })],
  })
  const first = simulatePlan(d).rows[0]
  assertClose(first.incomeTax, 8_000)
  assertClose(first.payrollTax, 40_000 * 0.0765)
  assertClose(first.balances.stock, 20_000)
  assertClose(first.balances.cash, 40_000 - 20_000 - 8_000 - 40_000 * 0.0765)
})

test("an ESPP discount buys extra shares and the gain is taxed as income", () => {
  const d = doc({
    incomes: [
      income("pay", "salary", 100_000, {
        contributions: [{ id: "c", accountId: "stock", percent: 0.1, employerMatchPercent: 0, preTax: false, discount: 0.15 }],
      }),
    ],
  })
  const first = simulatePlan(d).rows[0]
  const gain = (10_000 * 0.15) / 0.85
  assertClose(first.balances.stock, 10_000 + gain)
  assertClose(first.employerMatch, gain)
  assertClose(first.incomeTax, (100_000 + gain) * 0.2)
  // The discount isn't wages: payroll tax stays on salary alone.
  assertClose(first.payrollTax, 7_650)
})

test("adding RSUs with kept shares creates a company stock account; selling everything doesn't", () => {
  const base = doc({ accounts: [account("cash", "cash")] })
  const kept = applyEquity("rsu", { ...initialEquityDraft("rsu", base), company: "Acme", kept: 0.6, target: NEW_STOCK_ACCOUNT }, base)
  const stock = kept.accounts.find((a) => a.name === "Acme stock")
  assert.ok(stock)
  assert.equal(stock.taxTreatment, "taxable")
  assert.deepEqual(stock.mix, { stocks: 1, bonds: 0, cash: 0, crypto: 0 })
  const rsu = kept.incomes[0]
  assert.equal(rsu.kind, "equity")
  assert.equal(rsu.contributions[0].accountId, stock.id)
  assert.equal(rsu.contributions[0].percent, 0.6)
  assert.ok(planDocumentSchema.safeParse(kept).success)

  const sold = applyEquity("rsu", { ...initialEquityDraft("rsu", base), kept: 0 }, base)
  assert.equal(sold.accounts.length, 1)
  assert.equal(sold.incomes[0].contributions.length, 0)
})

test("options are a one-time grant; the shown amount is the gain at today's price", () => {
  const base = doc()
  const draft = initialEquityDraft("options", base)
  const d = applyEquity("options", { ...draft, grant: { symbol: "ACME", shares: 1_000, price: 30, strike: 10, volatility: 0.4 }, kept: 0 }, base)
  const [options] = d.incomes
  assert.equal(options.oneTime, true)
  assert.equal(options.amount, 20_000)
  assert.equal(options.name, "ACME stock options")
  assert.deepEqual(options.equity, { symbol: "ACME", shares: 1_000, price: 30, strike: 10, volatility: 0.4 })
  assert.ok(planDocumentSchema.safeParse(d).success)
})

test("expected option payoff: intrinsic with no time or swing, more than intrinsic with both, never negative", () => {
  assert.equal(expectedCallPayoff(30, 10, 0.4, 0), 20)
  assert.equal(expectedCallPayoff(30, 10, 0, 5), 20)
  assert.ok(expectedCallPayoff(30, 10, 0.4, 3) > 20)
  // Under water today, but worth something because the stock might rise past the strike.
  const underwater = expectedCallPayoff(8, 10, 0.4, 3)
  assert.ok(underwater > 0 && underwater < 8)
  // Matches Black–Scholes with r = 0: S=100, K=100, σ=20%, 1 year ≈ 7.9656.
  assertClose(expectedCallPayoff(100, 100, 0.2, 1), 7.9656, 0.001)
  assertClose(normalCdf(0), 0.5, 1e-7)
  assertClose(normalCdf(1.96), 0.975, 1e-4)
})

test("RSU vests follow the stock price: shares × price grown at the income's growth", () => {
  const rsu = income("rsu", "equity", 20_000, { growth: 0.1, equity: { symbol: "ACME", shares: 100, price: 200 } })
  const rows = simulatePlan(doc({ incomes: [rsu] })).rows
  assertClose(rows[0].incomeBy.rsu, 20_000)
  assertClose(rows[2].income, 100 * 200 * 1.1 * 1.1)
})

test("options in the plan pay the expected gain in their exercise year", () => {
  const opt = income("opt", "equity", 0, {
    oneTime: true,
    growth: 0,
    start: { type: "year", year: 2029 },
    equity: { symbol: null, shares: 1_000, price: 10, strike: 10, volatility: 0.4 },
  })
  const rows = simulatePlan(doc({ incomes: [opt] })).rows
  assertClose(rows[3].income, 1_000 * expectedCallPayoff(10, 10, 0.4, 3))
  assert.equal(rows[2].income, 0)
})

test("the stress test's market path sets the price, and options pay only what it leaves above the strike", () => {
  const opt = income("opt", "equity", 0, {
    oneTime: true,
    growth: 0,
    start: { type: "year", year: 2028 },
    equity: { symbol: null, shares: 1_000, price: 10, strike: 10, volatility: 0.4 },
  })
  const run = (yearly: number) => simulatePlan(doc({ incomes: [opt] }), { equityReturnFor: () => yearly }).rows[2].income
  assertClose(run(0.2), 1_000 * (10 * 1.2 * 1.2 - 10))
  assert.equal(run(-0.2), 0)
})

test("a single stock swings 1.5× the market around its own growth, never below −90%", () => {
  const market = { stockReal: 0.1, bondReal: 0, stockLogMean: Math.log(1.1) }
  assertClose(equityYearReturn(0.05, market, 0), 0.05, 1e-9)
  const crash = { stockReal: -0.4, bondReal: 0, stockLogMean: Math.log(1.065) }
  const fall = equityYearReturn(null, crash, 0)
  assert.ok(fall < -0.4 && fall >= -0.9)
})

test("an ESPP is added to the chosen salary as an after-tax, discounted contribution", () => {
  const base = doc({ incomes: [income("pay", "salary", 100_000)] })
  const d = applyEquity("espp", { ...initialEquityDraft("espp", base), target: "stock" }, base)
  const [c] = d.incomes[0].contributions
  assert.equal(c.accountId, "stock")
  assert.equal(c.preTax, false)
  assert.equal(c.discount, 0.15)
  assert.ok(planDocumentSchema.safeParse(d).success)
})
