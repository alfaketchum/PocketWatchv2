import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { applyEquity, initialEquityDraft, NEW_STOCK_ACCOUNT } from "@/components/plans/editor/equity-helpers"
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
  const rsu = kept.incomes[0]
  assert.equal(rsu.kind, "equity")
  assert.equal(rsu.contributions[0].accountId, stock.id)
  assert.equal(rsu.contributions[0].percent, 0.6)
  assert.ok(planDocumentSchema.safeParse(kept).success)

  const sold = applyEquity("rsu", { ...initialEquityDraft("rsu", base), kept: 0 }, base)
  assert.equal(sold.accounts.length, 1)
  assert.equal(sold.incomes[0].contributions.length, 0)
})

test("options add a one-time gain of shares × (price − strike)", () => {
  const base = doc()
  const d = applyEquity("options", { ...initialEquityDraft("options", base), shares: 1_000, strike: 10, price: 30, kept: 0 }, base)
  assert.equal(d.incomes[0].oneTime, true)
  assert.equal(d.incomes[0].amount, 20_000)
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
