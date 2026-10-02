import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { chartMilestones, debtPoints, layersFor, netWorthPoints } from "@/lib/plans/plan-chart"
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

test("layers split accounts by tax treatment; homes at full value; every debt, the mortgage too, below zero", () => {
  const layers = layersFor(doc, {
    accounts: { "acct-cash": 10, "acct-brokerage": 20, k: 30, r: 5, h: 5 },
    assets: { home: 300 },
    debts: { mtg: 200, cc: 7 },
  })
  assert.deepEqual(layers, { cash: 10, taxable: 20, taxDeferred: 30, taxFree: 10, taxFree529: 0, realAssets: 300, debt: -207 })
})

test("an underwater home: the full loan shows as debt, the home at its value", () => {
  const layers = layersFor(doc, { accounts: {}, assets: { home: 150 }, debts: { mtg: 200, cc: 0 } })
  assert.equal(layers.realAssets, 150)
  assert.equal(layers.debt, -200)
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
  // The 401(k) owner, born 1986, starts required withdrawals at 75.
  assert.deepEqual(marks.map((m) => [m.name, m.age]), [["Retirement", 65], ["Required withdrawals start", 75]])
})

test("chartMilestones marks the year each loan is paid off", () => {
  const loan = (id: string, name: string, balance: number) =>
    ({ id, name, kind: "auto" as const, balance, rate: 0, monthlyPayment: 1_000, start: { type: "planStart" as const }, assetId: null, source: null })
  const later = { ...loan("c", "RV", 12_000), start: { type: "age" as const, personId: doc.people[0].id, age: 50 } }
  const plan: PlanDocument = { ...doc, debts: [loan("a", "Car", 12_000), loan("b", "Boat", 24_000), later] }
  const payoffs = chartMilestones(plan, simulatePlan(plan)).filter((m) => m.kind === "payoff")
  assert.deepEqual(payoffs.map((m) => [m.name, m.age, m.icon]), [
    ["Car paid off", 40, "credit_score"],
    ["Boat paid off", 41, "credit_score"],
    ["RV paid off", 50, "credit_score"],
  ], "a loan taken out later isn't paid off before it starts")
})

import { yearMetrics } from "@/lib/plans/plan-year-metrics"

test("yearMetrics reads a working year like a P&L", () => {
  const plan: PlanDocument = {
    ...doc,
    settings: { ...doc.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0.2, cashBuffer: 0 },
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
  // 18k income tax (20% of 90k) + 7,650 payroll tax (7.65% of the full 100k).
  assert.equal(m.taxes, 25_650)
  assert.equal(m.effectiveTaxRate, 25_650 / 90_000)
  assert.equal(m.spending, 40_000)
  assert.equal(m.expenses, 65_650)
  // After-tax income 74,350, spending 40k → 34,350 kept (the 10% pre-tax 401k counts as kept).
  assert.ok(Math.abs((m.savingsRate ?? 0) - 34_350 / 74_350) < 1e-9)
  // Yours: 10k payroll + 24,350 left over after tax and spending; the employer's 5k is separate.
  assert.equal(m.contributions, 10_000 + 24_350)
  assert.equal(m.employerMatch, 5_000)
  // No taxable account and no buffer, so the leftover lands in Cash; the 401k gets the payroll share.
  assert.deepEqual(m.contributionsBy.map((c) => [c.name, c.value]), [["Cash", 24_350], ["401k", 10_000]])
  assert.equal(m.netWorthChange, 39_350)
  assert.equal(m.liquidNetWorth, 24_350)
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

import { CASH_IN_LAYERS, CASH_OUT_LAYERS, cashFlowPoints } from "@/lib/plans/plan-chart"

test("cash flow: money in equals money out every year, and retirement shows withdrawals", () => {
  const plan: PlanDocument = {
    ...doc,
    settings: { ...doc.settings, incomeTaxRate: 0.2, capitalGainsRate: 0.15 },
    incomes: [
      {
        id: "sal", name: "Salary", kind: "salary", amount: 120_000, growth: null, start: { type: "planStart" },
        end: { type: "age", personId: doc.people[0].id, age: 50 }, taxable: true, oneTime: false,
        contributions: [{ id: "c", accountId: "k", percent: 0.1, employerMatchPercent: 0.05, preTax: true }],
      },
    ],
    expenses: [{ id: "e", name: "Living", category: null, amount: 50_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  }
  const rows = simulatePlan(plan).rows
  const points = cashFlowPoints(plan, rows)
  for (const p of points) {
    const inflow = CASH_IN_LAYERS.reduce((s, k) => s + p[k], 0)
    const outflow = CASH_OUT_LAYERS.reduce((s, k) => s - p[k], 0)
    assert.ok(Math.abs(inflow - outflow) < 1e-6, `year ${p.year}: in ${inflow} vs out ${outflow}`)
  }
  const retired = points.find((p) => p.age === 55)!
  assert.equal(retired.income, 0)
  assert.ok(retired.wdCash + retired.wdTaxable + retired.wdTaxDeferred + retired.wdTaxFree > 50_000)
})

test("529 balances sit in their own tax-free band", () => {
  const plan: PlanDocument = {
    ...doc,
    accounts: [...doc.accounts, { id: "m529", name: "Maya's 529", taxTreatment: "education", balance: 40, costBasis: null, returnRate: 0, owner: null, source: null }],
  }
  const layers = layersFor(plan, { accounts: { r: 5, h: 5, m529: 40 }, assets: {}, debts: {} })
  assert.equal(layers.taxFree, 10)
  assert.equal(layers.taxFree529, 40)
})

test("debtPoints: each loan's balance at year end, positive, with the total owed", () => {
  const plan: PlanDocument = {
    ...doc,
    debts: [{ id: "car", name: "Car loan", kind: "auto", balance: 12_000, rate: 0, monthlyPayment: 500, start: { type: "planStart" }, assetId: null, source: null }],
  }
  const points = debtPoints(plan, simulatePlan(plan).rows)
  assert.equal(points[0].car, 6_000)
  assert.equal(points[0].owed, 6_000)
  assert.equal(points[1].car, 0)
})
