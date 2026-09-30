import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { CASH_IN_LAYERS, CASH_OUT_LAYERS, cashFlowPoints } from "@/lib/plans/plan-chart"
import { taxBase, totalTax } from "@/lib/plans/tax/tax-calc"
import type { PlanAccount, PlanDocument, PlanExpense } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

/** A $1M trading account bought at $1M, growing 10% a year. */
const trader = (extra: Partial<PlanAccount> = {}): PlanAccount => ({
  id: "brk", name: "Brokerage", taxTreatment: "taxable", balance: 1_000_000, costBasis: 1_000_000, returnRate: 0.1,
  owner: null, source: null, realizedShare: 1, shortTermShare: 0, ...extra,
})
const living = (amount: number): PlanExpense => ({
  id: "e", name: "Living", category: null, amount, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false,
})

function plan(accounts: PlanAccount[], expenses: PlanExpense[] = [], settings: Partial<PlanDocument["settings"]> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0.3, capitalGainsRate: 0.15, cashBuffer: 0, endAge: 50, ...settings },
    accounts,
    expenses,
  }
}

const taxes = (r: { incomeTax: number; withdrawalTax: number; saleTax: number; tradingTax: number }) =>
  r.incomeTax + r.withdrawalTax + r.saleTax + r.tradingTax

test("trading: realized gains are taxed the year they're made, long- and short-term", () => {
  close(simulatePlan(plan([trader()])).rows[0].tradingTax, 100_000 * 0.15)
  close(simulatePlan(plan([trader({ shortTermShare: 1 })])).rows[0].tradingTax, 100_000 * 0.3)
  close(simulatePlan(plan([trader({ realizedShare: 0.5 })])).rows[0].realizedGains, 50_000)
})

test("trading: buy and hold (0%) and retirement accounts owe nothing until withdrawal", () => {
  assert.equal(simulatePlan(plan([trader({ realizedShare: 0 })])).rows[0].tradingTax, 0)
  assert.equal(simulatePlan(plan([trader({ taxTreatment: "traditional" })])).rows[0].tradingTax, 0)
  const { realizedShare: _unused, ...legacy } = trader()
  assert.equal(simulatePlan(plan([legacy])).rows[0].tradingTax, 0)
})

test("trading: gains taxed while trading aren't taxed again when withdrawn", () => {
  const rows = simulatePlan(plan([trader()], [living(60_000)])).rows
  for (const r of rows) close(r.withdrawalTax, 0, 1e-6)
  assert.ok(rows.every((r) => r.tradingTax > 0))
})

test("trading: every dollar of growth is taxed at most once, part-realized or not", () => {
  for (const realizedShare of [0, 0.3, 0.5, 1]) {
    const rows = simulatePlan(plan([trader({ realizedShare })], [living(80_000)])).rows
    // No earned income, so taxable income is realized gains plus the gains inside withdrawals.
    const taxed = rows.reduce((s, r) => s + r.taxableIncome, 0)
    const grown = rows.reduce((s, r) => s + r.growth, 0)
    assert.ok(taxed <= grown + 1, `realized ${realizedShare}: taxed ${taxed} > growth ${grown}`)
  }
})

test("brackets: trading gains are taxed exactly once on the year's total", () => {
  const brackets = { taxMode: "brackets" as const, state: null, filingStatus: "single" as const }
  const r = simulatePlan(plan([trader({ shortTermShare: 1 })], [living(40_000)], brackets)).rows[0]
  close(taxes(r), totalTax(taxBase({ shortGains: 100_000 }), { status: "single", state: null, index: 1 }), 1)
  close(r.withdrawalTax, 0, 1e-6)
})

test("trading: money in equals money out every year, flat and brackets", () => {
  const settingsList: Partial<PlanDocument["settings"]>[] = [{}, { taxMode: "brackets", state: "CA", filingStatus: "single" }]
  for (const settings of settingsList) {
    const doc = plan(
      [{ id: "cash", name: "Cash", taxTreatment: "cash", balance: 20_000, costBasis: null, returnRate: 0, owner: null, source: null }, trader({ shortTermShare: 0.6, realizedShare: 0.8 })],
      [living(70_000)],
      settings,
    )
    for (const p of cashFlowPoints(doc, simulatePlan(doc).rows)) {
      const inflow = CASH_IN_LAYERS.reduce((s, k) => s + p[k], 0)
      const outflow = CASH_OUT_LAYERS.reduce((s, k) => s - p[k], 0)
      assert.ok(Math.abs(inflow - outflow) < 1e-6, `year ${p.year}: in ${inflow} vs out ${outflow}`)
    }
  }
})
