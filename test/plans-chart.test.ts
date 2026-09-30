import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { chartMilestones, layersFor, netWorthPoints } from "@/lib/plans/plan-chart"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import type { PlanDocument } from "@/lib/plans/plan-types"

const base = blankPlanDocument(new Date(2026, 0, 1), 40)
const doc: PlanDocument = {
  ...base,
  accounts: [
    { ...base.accounts[0], balance: 10 },
    { ...base.accounts[1], balance: 20 },
    { id: "k", name: "401k", taxTreatment: "traditional", balance: 30, costBasis: null, returnRate: 0, owner: null, source: null },
    { id: "r", name: "Roth", taxTreatment: "roth", balance: 5, costBasis: null, returnRate: 0, owner: null, source: null },
    { id: "h", name: "HSA", taxTreatment: "hsa", balance: 5, costBasis: null, returnRate: 0, owner: null, source: null },
  ],
  assets: [{ id: "home", name: "Home", kind: "home", value: 300, appreciation: 0, start: { type: "planStart" }, end: { type: "planEnd" } }],
  debts: [
    { id: "mtg", name: "Mortgage", kind: "mortgage", balance: 200, rate: 0, monthlyPayment: 0, start: { type: "planStart" }, assetId: "home", source: null },
    { id: "cc", name: "Card", kind: "credit", balance: 7, rate: 0, monthlyPayment: 0, start: { type: "planStart" }, assetId: null, source: null },
  ],
}

test("layers split accounts by tax treatment; home equity nets its mortgage; other debt goes below zero", () => {
  const layers = layersFor(doc, {
    accounts: { "acct-cash": 10, "acct-brokerage": 20, k: 30, r: 5, h: 5 },
    assets: { home: 300 },
    debts: { mtg: 200, cc: 7 },
  })
  assert.deepEqual(layers, { cash: 10, taxable: 20, taxDeferred: 30, taxFree: 10, realAssetEquity: 100, debt: -7 })
})

test("an underwater loan shows zero equity and the excess as debt", () => {
  const layers = layersFor(doc, { accounts: {}, assets: { home: 150 }, debts: { mtg: 200, cc: 0 } })
  assert.equal(layers.realAssetEquity, 0)
  assert.equal(layers.debt, -50)
})

test("netWorthPoints: one bar per year whose total matches the year's net worth", () => {
  const projection = simulatePlan(doc)
  const points = netWorthPoints(doc, projection.rows)
  assert.equal(points.length, projection.rows.length)
  assert.equal(points[0].age, 40)
  points.forEach((p, i) => assert.ok(Math.abs(p.netWorth - projection.rows[i].netWorth) < 1e-6))
})

test("chartMilestones places retirement by age", () => {
  const marks = chartMilestones(doc, simulatePlan(doc))
  assert.deepEqual(marks.map((m) => [m.name, m.age]), [["Retirement", 65]])
})
