import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { expandPlan } from "@/lib/plans/plan-expand"
import { withReplacements } from "@/lib/plans/plan-replacements"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const INFLATION = 0.03

/** Plan 2026–2060 (35 years), 3% inflation, no taxes, plenty of cash. */
function plan(assets: PlanAsset[]): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: INFLATION, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 75 },
    accounts: [{ ...base.accounts[0], balance: 5_000_000, returnRate: 0 }],
    assets,
  }
}
const car = (extra: Partial<PlanAsset> = {}): PlanAsset => ({
  id: "car", name: "Car", kind: "vehicle", value: 40_000, appreciation: -0.15, start: { type: "planStart" }, end: { type: "planEnd" },
  replaceEveryYears: 5, runningCosts: [{ name: "Insurance", amount: 1_000, basis: "dollars" }], ...extra,
})
const row = (d: PlanDocument, year: number) => simulatePlan(d).rows.find((r) => r.year === year)!

test("a car replaced every 5 years: one after another until the plan ends", () => {
  const assets = withReplacements(plan([car()]))
  assert.deepEqual(assets.map((a) => a.id), ["car", "car~2", "car~3", "car~4", "car~5", "car~6", "car~7"])
  assert.deepEqual(assets[1].start, { type: "year", year: 2031 })
  assert.deepEqual(assets[0].end, { type: "year", year: 2031 })
  assert.deepEqual(assets[6].end, { type: "planEnd" })
})

test("each replacement sells the old one at its value and buys at today's price plus inflation", () => {
  const r = row(plan([car()]), 2031)
  close(r.assetSales, 40_000 * Math.pow(0.85, 5))
  close(r.assetPurchases, 40_000 * Math.pow(1 + INFLATION, 5))
  close(Object.entries(r.expensesBy).filter(([id]) => id.startsWith("cost-")).reduce((s, [, v]) => s + v, 0), 1_000 * Math.pow(1 + INFLATION, 5))
})

test("a financed car: each replacement gets its own loan, and the old one is paid off from the sale", () => {
  const d = plan([car({ financing: { mode: "loan", downShare: 0.1, rate: 0.07, termYears: 7 } })])
  const loans = expandPlan(d).debts
  assert.equal(loans.length, 6)
  const r = row(d, 2036)
  const owedOnOld = simulatePlan(d).rows.find((x) => x.year === 2035)!.debtBalances["fin-car~2"]
  close(r.assetSales, 40_000 * Math.pow(1 + INFLATION, 5) * Math.pow(0.85, 5) - owedOnOld)
})

test("selling the car stops the cycle; milestones say Replace, and Sell only at the real sale", () => {
  const d = plan([car({ end: { type: "year", year: 2040 } })])
  assert.equal(withReplacements(d).length, 3)
  const names = expandPlan(d).milestones.map((m) => m.name).filter((n) => n.includes("Car"))
  assert.deepEqual(names, ["Replace Car", "Replace Car", "Sell Car"])
})

test("unrolling twice changes nothing; the plan stays valid", () => {
  const d = plan([car()])
  const once = expandPlan(d)
  assert.equal(expandPlan(once).assets.length, once.assets.length)
  assert.equal(expandPlan(once).expenses.length, once.expenses.length)
  assert.ok(planDocumentSchema.safeParse(d).success)
})
