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

import { yearMetrics } from "@/lib/plans/plan-year-metrics"

test("yearMetrics reads a working year like a P&L", () => {
  const plan: PlanDocument = {
    ...doc,
    settings: { ...doc.settings, inflation: 0, incomeTaxRate: 0.2, cashBuffer: 0 },
    accounts: [{ ...doc.accounts[0], balance: 0 }, { ...doc.accounts[2], balance: 0 }],
    assets: [],
    debts: [],
    incomes: [
      {
        id: "sal", name: "Salary", kind: "salary", amount: 100_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" },
        taxable: true, oneTime: false,
        contributions: [{ id: "c", accountId: "k", percent: 0.1, employerMatchPercent: 0.05, preTax: true }],
      },
    ],
    expenses: [{ id: "e", name: "Living", category: null, amount: 40_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  }
  const projection = simulatePlan(plan)
  const m = yearMetrics(plan, projection.rows, 0, projection.startNetWorth)!
  assert.equal(m.income, 100_000)
  assert.equal(m.taxableIncome, 90_000)
  assert.equal(m.taxes, 18_000)
  assert.equal(m.effectiveTaxRate, 0.2)
  assert.equal(m.spending, 40_000)
  assert.equal(m.expenses, 58_000)
  // After-tax income 82k, spending 40k → 51.2% kept (the 10% pre-tax 401k counts as kept).
  assert.ok(Math.abs((m.savingsRate ?? 0) - 42_000 / 82_000) < 1e-9)
  assert.equal(m.contributions, 15_000 + 32_000)
  assert.equal(m.netWorthChange, 47_000)
  assert.equal(m.liquidNetWorth, 32_000)
  assert.deepEqual(m.incomeSources.map((s) => s.label), ["Salary", "Employer match"])
})

test("assets report appreciation and depreciation separately", () => {
  const plan: PlanDocument = {
    ...doc,
    debts: [],
    assets: [
      { id: "home", name: "Home", kind: "home", value: 100_000, appreciation: 0.05, start: { type: "planStart" }, end: { type: "planEnd" } },
      { id: "car", name: "Car", kind: "vehicle", value: 20_000, appreciation: -0.1, start: { type: "planStart" }, end: { type: "planEnd" } },
    ],
  }
  const row = simulatePlan(plan).rows[0]
  assert.ok(Math.abs(row.assetAppreciation - 5_000) < 1e-6)
  assert.ok(Math.abs(row.assetDepreciation - 2_000) < 1e-6)
})
