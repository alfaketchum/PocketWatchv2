import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { afterTaxIncome, rowTaxes } from "@/lib/plans/plan-row-taxes"
import type { PlanAccount, PlanDocument, PlanSettings, YearRow } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

/** A brokerage that grows 10% a year and sells all of it each year (short-term `short` share). */
const brokerage = (short: number, balance = 1_000_000): PlanAccount => ({
  id: "brk", name: "Brokerage", taxTreatment: "taxable", balance, costBasis: null, returnRate: 0.1, owner: null, source: null,
  realizedShare: 1, shortTermShare: short,
})

function plan(accounts: PlanAccount[], salary = 0, settings: Partial<PlanSettings> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 45)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: null, filingStatus: "single", inflation: 0, cashBuffer: 0, protectBuffer: false, endAge: 50, ...settings },
    accounts,
    incomes: salary > 0
      ? [{ id: "w", name: "Salary", kind: "salary", amount: salary, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }]
      : [],
    expenses: [],
    cashFlow: { surplusOrder: [], withdrawalOrder: [] },
  }
}

/** How the year's income tax was charged (along the way plus the true-up), the kinds must add up to it. */
const charged = (r: YearRow) => r.incomeTax + r.withdrawalTax + r.saleTax + r.tradingTax

function assertAddsUp(d: PlanDocument) {
  for (const r of simulatePlan(d).rows) {
    close(r.ordinaryIncomeTax + r.shortGainsTax + r.longGainsTax, charged(r))
    close(rowTaxes(r), charged(r) + r.payrollTax + r.earlyWithdrawalPenalty)
  }
}

test("wages only: all of it is income tax", () => {
  const r = simulatePlan(plan([brokerage(0, 0)], 100_000)).rows[0]
  assert.ok(r.ordinaryIncomeTax > 0)
  close(r.shortGainsTax, 0)
  close(r.longGainsTax, 0)
  close(r.ordinaryIncomeTax, r.incomeTax)
  close(r.earnedIncomeTax, r.ordinaryIncomeTax)
})

test("short-term trading only: the tax is short-term gains tax, not income tax", () => {
  const r = simulatePlan(plan([brokerage(1)])).rows[0]
  assert.ok(r.shortGainsTax > 10_000, `short ${r.shortGainsTax}`)
  close(r.ordinaryIncomeTax, 0)
  close(r.longGainsTax, 0, 1)
})

test("long-term gains only: long-term gains tax (none in the 0% bracket)", () => {
  const big = simulatePlan(plan([brokerage(0)])).rows[0]
  assert.ok(big.longGainsTax > 5_000, `long ${big.longGainsTax}`)
  close(big.ordinaryIncomeTax, 0)
  close(big.shortGainsTax, 0)
  const small = simulatePlan(plan([brokerage(0, 300_000)])).rows[0]
  close(small.longGainsTax, 0, 1)
})

test("short-term gains stack on top of wages, at the higher rates", () => {
  const withWages = simulatePlan(plan([brokerage(1, 500_000)], 150_000)).rows[0]
  const alone = simulatePlan(plan([brokerage(1, 500_000)])).rows[0]
  assert.ok(withWages.shortGainsTax > alone.shortGainsTax)
  close(withWages.ordinaryIncomeTax, simulatePlan(plan([brokerage(1, 0)], 150_000)).rows[0].ordinaryIncomeTax, 1)
})

test("the kinds add up exactly every year: mixed income, brackets, flat rates, special state gains rules", () => {
  const mixed = [brokerage(0.6), { ...brokerage(0, 400_000), id: "ira", name: "IRA", taxTreatment: "traditional" as const, realizedShare: 0 }]
  assertAddsUp(plan(mixed, 120_000))
  assertAddsUp(plan(mixed, 120_000, { state: "NJ" }))
  assertAddsUp(plan(mixed, 120_000, { state: "WA" }))
  assertAddsUp(plan(mixed, 0, { state: "CA", filingStatus: "joint" }))
  assertAddsUp(plan(mixed, 120_000, { taxMode: "flat", incomeTaxRate: 0.25, capitalGainsRate: 0.15 }))
  // Spending that forces taxable sales, then 401(k)/IRA withdrawals (with the early penalty) once the brokerage is gone.
  const spend = { id: "e", name: "Living", category: null, amount: 250_000, growth: 0, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, oneTime: false }
  const lean = [{ ...brokerage(0.3, 300_000), realizedShare: 0 }, { ...brokerage(0, 900_000), id: "ira", name: "IRA", taxTreatment: "traditional" as const, realizedShare: 0 }]
  const drawn = { ...plan(lean, 0, { state: "NJ" }), expenses: [spend] }
  assert.ok(simulatePlan(drawn).rows.some((r) => r.earlyWithdrawalPenalty > 0), "the plan reaches the 401(k) before 59½")
  assertAddsUp(drawn)
})

test("flat rates: short-term gains at the income rate, long-term at the gains rate", () => {
  const r = simulatePlan(plan([brokerage(0.5)], 0, { taxMode: "flat", incomeTaxRate: 0.3, capitalGainsRate: 0.15 })).rows[0]
  close(r.shortGainsTax, 50_000 * 0.3)
  close(r.longGainsTax, 50_000 * 0.15)
  close(r.ordinaryIncomeTax, 0)
})

test("after-tax income takes off only the tax on earned income, not the tax on gains", () => {
  const r = simulatePlan(plan([brokerage(1)], 80_000)).rows[0]
  close(r.earnedIncomeTax, simulatePlan(plan([brokerage(1, 0)], 80_000)).rows[0].ordinaryIncomeTax, 1)
  close(afterTaxIncome(r), 80_000 - r.earnedIncomeTax - r.payrollTax)
})
