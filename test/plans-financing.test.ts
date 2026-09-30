import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { expandPlan } from "@/lib/plans/plan-expand"
import { financingDebts, loanSummary, monthlyPayment, paidWithLabel, TYPICAL_FINANCING } from "@/lib/plans/plan-financing"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const INFLATION = 0.03

/** 3% inflation, no taxes, $1M cash so purchases never run short; plan starts 2026. */
function plan(assets: PlanAsset[], debts: PlanDebt[] = []): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: INFLATION, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 60 },
    accounts: [{ ...base.accounts[0], balance: 1_000_000, returnRate: 0 }],
    assets,
    debts,
  }
}

const car = (extra: Partial<PlanAsset> = {}): PlanAsset => ({
  id: "car", name: "Car", kind: "vehicle", value: 40_000, appreciation: -0.15, start: { type: "year", year: 2030 }, end: { type: "planEnd" }, ...extra,
})
const row = (d: PlanDocument, year: number) => simulatePlan(d).rows.find((r) => r.year === year)!
const priceIn2030 = 40_000 * Math.pow(1 + INFLATION, 4)

test("a future purchase costs today's price grown by inflation, then loses value from there", () => {
  const r = row(plan([car()]), 2030)
  close(r.assetPurchases, priceIn2030)
  close(r.assetValues.car, priceIn2030 * 0.85)
})

test("cash (or no choice, as in older plans): the whole price comes from cash flow, no loan", () => {
  for (const asset of [car(), car({ financing: { mode: "cash", ...TYPICAL_FINANCING.vehicle } })]) {
    assert.equal(financingDebts(plan([asset])).length, 0)
    close(row(plan([asset]), 2030).assetPurchases, priceIn2030)
  }
})

test("a loan: only the down payment comes from cash flow; the loan is sized on that year's price", () => {
  const d = plan([car({ financing: { mode: "loan", downShare: 0.2, rate: 0.06, termYears: 5 } })])
  const [loan] = financingDebts(d)
  close(loan.balance, priceIn2030 * 0.8)
  close(loan.monthlyPayment, monthlyPayment(priceIn2030 * 0.8, 0.06, 60))
  assert.equal(loan.kind, "auto")
  const r = row(d, 2030)
  close(r.assetPurchases, priceIn2030 * 0.2)
  close(r.debtPayments, loan.monthlyPayment * 12)
})

test("not decided yet uses typical terms for the kind", () => {
  const [loan] = financingDebts(plan([car({ financing: { mode: "undecided", downShare: 0.5, rate: 0.01, termYears: 2 } })]))
  close(loan.balance, priceIn2030 * (1 - TYPICAL_FINANCING.vehicle.downShare))
  assert.equal(loan.rate, TYPICAL_FINANCING.vehicle.rate)
})

test("a loan already linked to the asset wins, and assets owned now or inherited generate none", () => {
  const real: PlanDebt = { id: "real", name: "Real loan", kind: "auto", balance: 30_000, rate: 0.05, monthlyPayment: 600, start: { type: "year", year: 2030 }, assetId: "car", source: null }
  const financed = car({ financing: { mode: "undecided", ...TYPICAL_FINANCING.vehicle } })
  assert.equal(financingDebts(plan([financed], [real])).length, 0)
  assert.equal(paidWithLabel(financed, plan([financed], [real])), "Real loan")
  assert.equal(financingDebts(plan([{ ...financed, start: { type: "planStart" } }])).length, 0)
  assert.equal(financingDebts(plan([{ ...financed, acquired: "received" }])).length, 0)
})

test("expanding twice doesn't add the loan twice; the plan stays valid", () => {
  const d = plan([car({ financing: { mode: "loan", downShare: 0.1, rate: 0.07, termYears: 5 } })])
  assert.equal(expandPlan(expandPlan(d)).debts.length, 1)
  assert.ok(planDocumentSchema.safeParse(d).success)
})

test("loan summary: down, loan, payment and total interest", () => {
  const s = loanSummary(40_000, { downShare: 0.1, rate: 0.075, termYears: 5 })
  assert.deepEqual([s.down, s.loan], [4_000, 36_000])
  close(s.monthly, 721.37, 0.01)
  close(s.totalInterest, s.monthly * 60 - 36_000)
})
