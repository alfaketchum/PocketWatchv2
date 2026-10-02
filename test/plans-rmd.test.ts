import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { rowTaxes } from "@/lib/plans/plan-row-taxes"
import { penaltyFree, rmdDivisor, rmdStartAge } from "@/lib/plans/tax/retirement-rules-2026"
import type { PlanAccount, PlanDocument, PlanSettings, TaxTreatment } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

const account = (id: string, taxTreatment: TaxTreatment, balance: number, extra: Partial<PlanAccount> = {}): PlanAccount => ({
  id, name: id, taxTreatment, balance, costBasis: null, returnRate: 0, owner: null, source: null, ...extra,
})

/** Plan starting 2026 for someone `age` (born January); no income, flat 20% income tax, no gains tax, nothing kept aside. */
function plan(age: number, accounts: PlanAccount[], spend = 0, settings: Partial<PlanSettings> = {}, patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), age)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0.2, capitalGainsRate: 0, cashBuffer: 0, protectBuffer: false, endAge: age + 6, ...settings },
    accounts,
    incomes: [],
    expenses: spend > 0 ? [{ id: "e", name: "Living", category: null, amount: spend, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }] : [],
    cashFlow: { surplusOrder: [], withdrawalOrder: [] },
    ...patch,
  }
}

const rowFor = (d: PlanDocument, year: number) => simulatePlan(d).rows.find((r) => r.year === year)!

test("rules: start age 73, or 75 if born 1960+; IRS Uniform Lifetime factors; 59½", () => {
  assert.equal(rmdStartAge(1955), 73)
  assert.equal(rmdStartAge(1959), 73)
  assert.equal(rmdStartAge(1960), 75)
  assert.equal(rmdDivisor(73), 26.5)
  assert.equal(rmdDivisor(75), 24.6)
  assert.equal(rmdDivisor(90), 12.2)
  assert.equal(rmdDivisor(125), 2.0)
  const jan = { id: "p", name: "P", birthYear: 1970, birthMonth: 3 }
  assert.equal(penaltyFree(jan, 2028), false)
  assert.equal(penaltyFree(jan, 2029), true)
  assert.equal(penaltyFree({ ...jan, birthMonth: 9 }, 2029), false)
  assert.equal(penaltyFree({ ...jan, birthMonth: 9 }, 2030), true)
})

test("the year you turn 73 the IRA pays out last year-end's balance ÷ 26.5, taxed; what isn't spent is reinvested", () => {
  const d = plan(72, [account("ira", "traditional", 265_000), account("brokerage", "taxable", 0)])
  assert.equal(rowFor(d, 2026).requiredWithdrawals, 0)
  const r = rowFor(d, 2027)
  close(r.requiredWithdrawals, 10_000)
  close(r.withdrawalsBy.ira, 10_000)
  close(r.withdrawalTax, 2_000)
  close(r.taxableIncome, 10_000)
  close(r.balances.brokerage, 8_000)
  close(r.balances.ira, 255_000)
  // Next year: 255,000 ÷ 25.5
  close(rowFor(d, 2028).requiredWithdrawals, 10_000)
})

test("the required withdrawal pays spending first, so the rest isn't drawn twice", () => {
  const d = plan(73, [account("ira", "traditional", 265_000), account("brokerage", "taxable", 50_000)], 6_000)
  const r = rowFor(d, 2026)
  close(r.requiredWithdrawals, 10_000)
  close(r.withdrawals, 10_000)
  close(r.balances.brokerage, 52_000)
})

test("no required withdrawals from Roth, HSA or inherited accounts", () => {
  const d = plan(80, [
    account("roth", "roth", 100_000),
    account("hsa", "hsa", 50_000),
    account("inherited", "traditional", 100_000, { drainByYear: 2035 }),
    account("brokerage", "taxable", 0),
  ])
  const r = rowFor(d, 2026)
  assert.equal(r.requiredWithdrawals, 0)
  close(r.withdrawalsBy.inherited, 10_000)
})

test("a partner's IRA follows the partner's age", () => {
  const base = plan(60, [account("ira", "traditional", 229_000, { owner: "partner" }), account("brokerage", "taxable", 0)])
  const d: PlanDocument = { ...base, people: [...base.people, { id: "partner", name: "Sam", birthYear: 2026 - 77, birthMonth: 1 }] }
  close(rowFor(d, 2026).requiredWithdrawals, 229_000 / 22.9)
  const mine = plan(60, [account("ira", "traditional", 229_000), account("brokerage", "taxable", 0)])
  assert.equal(rowFor(mine, 2026).requiredWithdrawals, 0)
})

test("before 59½ a 401(k) withdrawal pays the 10% penalty on top of income tax", () => {
  const d = plan(45, [account("ira", "traditional", 100_000)], 30_000)
  const r = rowFor(d, 2026)
  const gross = 30_000 / (1 - 0.2 - 0.1)
  close(r.withdrawalsBy.ira, gross)
  close(r.earlyWithdrawalPenalty, gross * 0.1)
  close(r.withdrawalTax, gross * 0.2)
  close(rowTaxes(r), gross * 0.3)
  assert.equal(rowFor(plan(60, [account("ira", "traditional", 100_000)], 30_000), 2026).earlyWithdrawalPenalty, 0)
})

test("by default the 401(k) is used last before 59½; switched off, your order applies and the penalty is paid", () => {
  const accounts = [account("ira", "traditional", 100_000), account("brokerage", "taxable", 50_000)]
  const order = { surplusOrder: [], withdrawalOrder: ["ira", "brokerage"] }
  const avoid = rowFor(plan(45, accounts, 30_000, {}, { cashFlow: order }), 2026)
  close(avoid.withdrawalsBy.brokerage, 30_000)
  assert.equal(avoid.withdrawalsBy.ira ?? 0, 0)
  assert.equal(avoid.earlyWithdrawalPenalty, 0)
  const follow = rowFor(plan(45, accounts, 30_000, {}, { cashFlow: { ...order, avoidEarlyPenalty: false } }), 2026)
  assert.ok((follow.withdrawalsBy.ira ?? 0) > 30_000)
  assert.ok(follow.earlyWithdrawalPenalty > 0)
  // After 59½ the plan's own order applies again, penalty-free.
  const later = rowFor(plan(62, accounts, 30_000, {}, { cashFlow: order }), 2026)
  assert.ok((later.withdrawalsBy.ira ?? 0) > 30_000)
  assert.equal(later.earlyWithdrawalPenalty, 0)
})

test("with real brackets the penalty stays 10% of the early withdrawal (the tax true-up doesn't refund it)", () => {
  const d = plan(45, [account("ira", "traditional", 500_000)], 60_000, { taxMode: "brackets", state: null, filingStatus: "single" })
  const r = rowFor(d, 2026)
  assert.ok(r.earlyWithdrawalPenalty > 0)
  close(r.earlyWithdrawalPenalty, 0.1 * r.withdrawalsBy.ira, 1)
})
