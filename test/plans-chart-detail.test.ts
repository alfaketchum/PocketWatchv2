import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { CASH_IN_LAYERS, CASH_OUT_LAYERS, cashFlowPoints, NET_WORTH_LAYERS, netWorthPoints } from "@/lib/plans/plan-chart"
import { cashFlowDetail, expensesView, netWorthDetail } from "@/lib/plans/plan-chart-detail"
import { expandPlan } from "@/lib/plans/plan-expand"
import type { PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

/** Salary, spending, a car on a loan, two accounts, taxes: every kind of band. */
function plan(): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return expandPlan({
    ...base,
    settings: { ...base.settings, taxMode: "flat", endAge: 70 },
    accounts: [{ ...base.accounts[0], balance: 30_000 }, { ...base.accounts[1], balance: 200_000, realizedShare: 0.5 }],
    incomes: [{ id: "sal", name: "Salary", kind: "salary", amount: 120_000, growth: null, start: { type: "planStart" }, end: { type: "age", personId: base.people[0].id, age: 55 }, taxable: true, oneTime: false, contributions: [] }],
    expenses: [{ id: "e", name: "Living", category: null, amount: 70_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    assets: [{ id: "car", name: "Car", kind: "vehicle", value: 40_000, appreciation: -0.15, start: { type: "year", year: 2028 }, end: { type: "planEnd" }, financing: { mode: "loan", downShare: 0.2, rate: 0.07, termYears: 5 } }],
  })
}

const sumParent = (row: Record<string, number>, keys: string[]) => keys.reduce((s, k) => s + (row[k] ?? 0), 0)

test("net worth subcategories add up to each band, and to net worth", () => {
  const d = plan()
  const rows = simulatePlan(d).rows
  const grouped = netWorthPoints(d, rows)
  const { series, points } = netWorthDetail(d, rows)
  points.forEach((p, i) => {
    for (const layer of [...NET_WORTH_LAYERS, "debt" as const]) {
      close(sumParent(p, series.filter((s) => s.parent === layer).map((s) => s.key)), grouped[i][layer])
    }
    close(p.netWorth, grouped[i].netWorth)
  })
})

test("cash flow subcategories add up to each band every year", () => {
  const d = plan()
  const rows = simulatePlan(d).rows
  const grouped = cashFlowPoints(d, rows)
  const { series, points } = cashFlowDetail(d, rows)
  points.forEach((p, i) => {
    for (const layer of [...CASH_IN_LAYERS, ...CASH_OUT_LAYERS]) {
      close(sumParent(p, series.filter((s) => s.parent === layer).map((s) => s.key)), grouped[i][layer], 1e-4)
    }
  })
})

test("expenses view: groups and every-line detail add up to the same total spent", () => {
  const d = plan()
  const rows = simulatePlan(d).rows
  const grouped = expensesView(d, rows, false)
  const detailed = expensesView(d, rows, true)
  grouped.points.forEach((p, i) => {
    const byGroup = sumParent(p, grouped.series.map((s) => s.key))
    const byLine = sumParent(detailed.points[i], detailed.series.map((s) => s.key))
    close(byGroup, p.spent, 1e-4)
    close(byLine, p.spent, 1e-4)
    close(p.spent, rows[i].expenses + rows[i].debtPayments + rows[i].incomeTax + rows[i].withdrawalTax + rows[i].saleTax + rows[i].tradingTax, 1e-4)
  })
  assert.ok(detailed.series.some((s) => s.group === "debt"))
})
