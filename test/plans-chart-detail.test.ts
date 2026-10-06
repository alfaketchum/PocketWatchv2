import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { CASH_IN_LAYERS, CASH_OUT_LAYERS, cashFlowPoints, NET_WORTH_LAYERS, netWorthPoints } from "@/lib/plans/plan-chart"
import { cashFlowDetail, expensesView, INCOME_GROUPS, incomeView, netWorthDetail, taxesView } from "@/lib/plans/plan-chart-detail"
import { expandPlan } from "@/lib/plans/plan-expand"
import { TAX_PARTS } from "@/lib/plans/plan-row-taxes"
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
    close(p.spent, rows[i].expenses + rows[i].debtPayments + rows[i].incomeTax + rows[i].payrollTax + rows[i].withdrawalTax + rows[i].saleTax + rows[i].tradingTax, 1e-4)
  })
  assert.ok(detailed.series.some((s) => s.group === "debt"))
})

test("income view: groups by kind and every-line detail add up to each year's income", () => {
  const base = plan()
  const d: PlanDocument = {
    ...base,
    incomes: [
      ...base.incomes,
      { id: "ss", name: "Social Security", kind: "social_security", amount: 30_000, growth: null, start: { type: "age", personId: base.people[0].id, age: 67 }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] },
    ],
  }
  const rows = simulatePlan(d).rows
  const grouped = incomeView(d, rows, false)
  const lines = incomeView(d, rows, true)
  rows.forEach((r, i) => {
    close(sumParent(grouped.points[i], [...INCOME_GROUPS]), r.income)
    close(sumParent(lines.points[i], lines.series.map((s) => s.key)), r.income)
  })
  assert.deepEqual(lines.series.map((s) => s.group), ["work", "socialSecurity"])
  assert.ok(rows.some((r, i) => grouped.points[i].socialSecurity > 0 && grouped.points[i].work === 0))
})

test("taxes view: the total band and the kinds of tax add up to every tax paid that year", () => {
  const d = plan()
  const rows = simulatePlan(d).rows
  const total = taxesView(d, rows, false)
  const kinds = taxesView(d, rows, true)
  assert.equal(kinds.series.length, TAX_PARTS.length)
  rows.forEach((r, i) => {
    const paid = r.incomeTax + r.payrollTax + r.withdrawalTax + r.saleTax + r.tradingTax + r.earlyWithdrawalPenalty
    close(total.points[i].taxes, paid)
    close(sumParent(kinds.points[i], kinds.series.map((s) => s.key)), paid)
  })
  assert.ok(rows.some((r) => r.incomeTax > 0) && rows.some((r) => r.tradingTax > 0))
})

test("expenses view by category: one band per category, adding up to the same total spent", () => {
  const base = plan()
  const groceries = { id: "g1", name: "Groceries", category: "Food", amount: 9_000, growth: null, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, oneTime: false }
  const d: PlanDocument = { ...base, expenses: [...base.expenses, groceries, { ...groceries, id: "g2", name: "Eating out", amount: 3_000 }] }
  const rows = simulatePlan(d).rows
  const { series, points } = expensesView(d, rows, true, true)
  const spending = series.filter((s) => s.parent === "spending").map((s) => s.label)
  assert.equal(spending.filter((l) => l === "Food").length, 1)
  assert.ok(spending.includes("Uncategorized"))
  assert.ok(!spending.includes("Groceries"))
  points.forEach((p) => close(sumParent(p, series.map((s) => s.key)), p.spent, 1e-4))
})

test("cash flow by category still adds up to each band every year", () => {
  const d = plan()
  const rows = simulatePlan(d).rows
  const grouped = cashFlowPoints(d, rows)
  const { series, points } = cashFlowDetail(d, rows, true)
  assert.ok(series.some((s) => s.key.startsWith("cat:")))
  assert.ok(!series.some((s) => s.key.startsWith("sp:")))
  points.forEach((p, i) => {
    for (const layer of [...CASH_IN_LAYERS, ...CASH_OUT_LAYERS]) {
      close(sumParent(p, series.filter((s) => s.parent === layer).map((s) => s.key)), grouped[i][layer], 1e-4)
    }
  })
})
