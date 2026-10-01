import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { assetValue } from "@/lib/plans/engine/engine-assets"
import { assetCostExpenses, assetCostLines, totalYearlyCost, TYPICAL_RUNNING_COSTS } from "@/lib/plans/plan-asset-costs"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { expandPlan } from "@/lib/plans/plan-expand"
import type { PlanAsset, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const INFLATION = 0.03

function plan(assets: PlanAsset[], extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: INFLATION, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 60 },
    accounts: [{ ...base.accounts[0], balance: 5_000_000, returnRate: 0 }],
    assets,
    ...extra,
  }
}
const costs = (d: PlanDocument, year: number) => {
  const r = simulatePlan(d).rows.find((x) => x.year === year)!
  return Object.entries(r.expensesBy).filter(([id]) => id.startsWith("cost-")).reduce((s, [, v]) => s + v, 0)
}

const car: PlanAsset = {
  id: "car", name: "Car", kind: "vehicle", value: 40_000, appreciation: -0.15,
  start: { type: "year", year: 2030 }, end: { type: "year", year: 2035 }, runningCosts: [{ name: "Insurance", amount: 1_800, basis: "dollars" }],
}
const house: PlanAsset = {
  id: "house", name: "House", kind: "home", value: 500_000, appreciation: 0.05,
  start: { type: "year", year: 2030 }, end: { type: "planEnd" }, runningCosts: [{ name: "Property tax", amount: 0.01, basis: "percentOfValue" }],
}

test("dollar costs run only while owned, rising with inflation", () => {
  const d = plan([car])
  assert.equal(costs(d, 2029), 0)
  close(costs(d, 2030), 1_800 * Math.pow(1 + INFLATION, 4))
  close(costs(d, 2034), 1_800 * Math.pow(1 + INFLATION, 8))
  assert.equal(costs(d, 2035), 0)
})

test("a share of value follows the asset's value each year", () => {
  const d = plan([house])
  for (const year of [2030, 2032, 2040]) close(costs(d, year), 0.01 * assetValue(house, 4, year - 2026, INFLATION, INFLATION))
})

test("a move's spending change doesn't scale ownership costs", () => {
  const moved = plan([car], { adjustments: [{ id: "m", kind: "spending", timing: { type: "year", year: 2027 }, percent: -0.5 }] })
  close(costs(moved, 2031), costs(plan([car]), 2031))
})

test("typical costs, totals, and expanding twice doesn't double them", () => {
  const home = { ...house, runningCosts: TYPICAL_RUNNING_COSTS.home }
  close(totalYearlyCost(home), 500_000 * (0.011 + 0.0035 + 0.01))
  close(totalYearlyCost({ ...car, runningCosts: TYPICAL_RUNNING_COSTS.vehicle }), 3_200)
  const d = plan([home])
  assert.equal(assetCostExpenses(d).length, 3)
  assert.equal(expandPlan(expandPlan(d)).expenses.length, 3)
  assert.equal(assetCostExpenses(plan([{ ...house, runningCosts: undefined }])).length, 0)
})


test("Expenses lists home and vehicle running costs read-only, at today's cost and tied to their asset", () => {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  const doc = {
    ...base,
    assets: [
      { id: "h", name: "House", kind: "home" as const, value: 500_000, appreciation: 0.03, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, runningCosts: [{ name: "Insurance", amount: 0.004, basis: "percentOfValue" as const }] },
      { id: "c", name: "Car", kind: "vehicle" as const, value: 30_000, appreciation: -0.15, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, runningCosts: [{ name: "Insurance", amount: 1_800, basis: "dollars" as const }] },
    ],
  }
  const lines = assetCostLines(doc)
  assert.deepEqual(lines.map((l) => [l.asset.id, l.yearly, l.followsValue]), [["h", 2_000, true], ["c", 1_800, false]])
})
