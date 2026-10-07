import test from "node:test"
import assert from "node:assert/strict"
import "./setup-env"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { LOAN_PAYMENTS_CATEGORY, OTHER_PLANNED_CATEGORY, planYearIndex, plannedForMonth } from "@/lib/plans/check-in/planned-month"
import { compareCategories, planChangedFlags, plannedAtTheTime, type PlanCheckInRow } from "@/lib/plans/check-in/check-in-rows"
import { bucketCashflow } from "@/lib/finance/monthly-cashflow"
import { actualSpending, parseCheckInMonth, previousMonth } from "@/lib/plans/check-in/record-check-in"
import type { PlanAccount, PlanDocument, PlanExpense, PlanIncome } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 9, 15)

function account(id: string, balance = 0): PlanAccount {
  return { id, name: id, taxTreatment: "taxable", balance, costBasis: null, returnRate: 0, owner: null, source: null }
}

function income(amount: number, extra: Partial<PlanIncome> = {}): PlanIncome {
  return {
    id: "inc", name: "Salary", kind: "salary", amount, growth: 0,
    start: { type: "planStart" }, end: { type: "planEnd" }, taxable: false, oneTime: false, contributions: [], ...extra,
  }
}

function expense(id: string, amount: number, extra: Partial<PlanExpense> = {}): PlanExpense {
  return { id, name: id, category: null, amount, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false, ...extra }
}

/** Starts October 2026; zero inflation and taxes, one taxable account. */
function doc(patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 45 },
    accounts: [account("brokerage", 10_000)],
    incomes: [],
    expenses: [],
    ...patch,
  }
}

function row(month: string, extra: Partial<PlanCheckInRow> = {}): PlanCheckInRow {
  return {
    month, planId: "p", planName: "Plan", planHash: "a", plannedSource: "live",
    plannedNetWorth: 100, plannedIncome: 0, plannedSpending: 0, plannedByCategory: {}, plannedOneTime: 0,
    actualNetWorth: 100, actualIncome: 0, actualSpending: 0, actualByCategory: {}, ...extra,
  }
}

test("planYearIndex: plan years start at the plan's start month; earlier months use the first year", () => {
  const d = doc()
  assert.equal(planYearIndex(d, 2026, 10), 0)
  assert.equal(planYearIndex(d, 2027, 9), 0)
  assert.equal(planYearIndex(d, 2027, 10), 1)
  assert.equal(planYearIndex(d, 2026, 3), 0)
})

test("plannedForMonth: a twelfth of the year, spending by category, loan payments and one-time items apart", () => {
  const d = doc({
    incomes: [income(120_000)],
    expenses: [
      expense("food", 12_000, { category: "Food & Dining" }),
      expense("misc", 6_000),
      expense("car", 30_000, { category: "Transportation", oneTime: true }),
    ],
  })
  const p = plannedForMonth(d, simulatePlan(d), 2026, 11)
  assert.ok(p)
  assert.equal(p.income, 10_000)
  assert.equal(p.byCategory["Food & Dining"], 1_000)
  assert.equal(p.byCategory[OTHER_PLANNED_CATEGORY], 500)
  assert.equal(p.byCategory.Transportation, undefined)
  assert.equal(p.byCategory[LOAN_PAYMENTS_CATEGORY], undefined)
  assert.equal(p.spending, 1_500)
  assert.equal(p.oneTime, 30_000)
})

test("plannedForMonth: take-home is gross less payroll contributions", () => {
  const d = doc({
    incomes: [income(120_000, { contributions: [{ id: "c", accountId: "brokerage", percent: 0.1, employerMatchPercent: 0.05, preTax: false }] })],
  })
  assert.equal(plannedForMonth(d, simulatePlan(d), 2026, 11)?.income, 9_000)
})

test("plannedForMonth: net worth at month end, null before the plan starts", () => {
  const d = doc()
  const projection = simulatePlan(d)
  assert.equal(plannedForMonth(d, projection, 2026, 9)?.netWorth, 10_000)
  assert.equal(plannedForMonth(d, projection, 2026, 8)?.netWorth, null)
})

test("bucketCashflow: income is categorized money in; spending skips transfers and investments", () => {
  const tx = (date: string, amount: number, category: string | null) => ({ date: new Date(`${date}T00:00:00Z`), amount, category })
  const m = bucketCashflow(
    [
      tx("2026-09-01", -5000, "Income"),
      tx("2026-09-02", -40, "Shopping"),
      tx("2026-09-03", 100, "Food & Dining"),
      tx("2026-09-04", 900, "Transfer"),
      tx("2026-09-05", 25, null),
      tx("2026-10-01", 999, "Food & Dining"),
    ],
    ["2026-09"],
  ).get("2026-09")!
  assert.equal(m.income, 5000)
  assert.equal(m.spending, 125)
  assert.deepEqual([...m.categories.entries()], [["Food & Dining", 100], ["Uncategorized", 25]])
})

test("actualSpending leaves taxes out", () => {
  const s = actualSpending({ income: 0, spending: 0, categories: new Map([["Taxes", 2000], ["Housing", 1500.004]]) })
  assert.equal(s.spending, 1500)
  assert.deepEqual(s.byCategory, { Housing: 1500 })
})

test("previousMonth and parseCheckInMonth", () => {
  assert.deepEqual(previousMonth(new Date(2026, 0, 1)), { year: 2025, month: 12 })
  assert.deepEqual(parseCheckInMonth("2026-09"), { year: 2026, month: 9 })
  assert.equal(parseCheckInMonth("2026-13"), null)
})

test("planChangedFlags marks a month whose plan differs from the month before", () => {
  const flags = planChangedFlags([row("2026-11", { planHash: "b" }), row("2026-10", { planHash: "a" }), row("2026-09", { planHash: "a" })])
  assert.deepEqual(flags, [true, false, false])
})

test("compareCategories: both sides, biggest overspend first", () => {
  const c = compareCategories(row("2026-10", { plannedByCategory: { Housing: 2000, Travel: 300 }, actualByCategory: { Housing: 2100, Shopping: 400 } }))
  assert.deepEqual(c.map((x) => [x.category, x.over]), [["Shopping", 400], ["Housing", 100], ["Travel", -300]])
})

test("plannedAtTheTime: live rows only, at month end, oldest first", () => {
  const points = plannedAtTheTime([row("2026-12", { plannedNetWorth: 3 }), row("2026-11", { plannedSource: "backfill" }), row("2026-06", { plannedNetWorth: 1 })])
  assert.deepEqual(points, [{ x: 2026.5, value: 1 }, { x: 2027, value: 3 }])
})
