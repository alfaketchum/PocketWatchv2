import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan, type SimulateOptions } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { summarize } from "@/lib/plans/stress/stress-test"
import type { PlanDocument, PlanExpense, SpendingRule } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

const line = (id: string, amount: number, category: string | null = null): PlanExpense => ({
  id, name: id, category, amount, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false,
})

/** 64 at the start (retires at 65 = plan year 1); $1M brokerage, no return, no tax; $40k living + $10k kids. */
function plan(rule?: SpendingRule): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 64)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, protectBuffer: false, endAge: 80, spendingRule: rule },
    accounts: [{ id: "brk", name: "Brokerage", taxTreatment: "taxable", balance: 1_000_000, costBasis: null, returnRate: 0, owner: null, source: null }],
    incomes: [],
    expenses: [line("living", 40_000), line("kids", 10_000, "Kids")],
    cashFlow: { surplusOrder: [], withdrawalOrder: [] },
  }
}

const run = (d: PlanDocument, opts: SimulateOptions = {}) => simulatePlan(d, opts).rows

test("no rule: spend as planned, factor 1 every year", () => {
  for (const r of run(plan())) {
    assert.equal(r.spendingFactor, 1)
    close(r.expenses, r.plannedSpending)
    close(r.expensesBy.living, 40_000)
  }
})

test("% of portfolio: living costs become rate × last year-end's portfolio from retirement; kids untouched", () => {
  const rows = run(plan({ kind: "percent", rate: 0.05, floor: null, ceiling: null }))
  close(rows[0].expensesBy.living, 40_000, 0.01)
  for (let i = 1; i < rows.length; i++) {
    close(rows[i].expensesBy.living, 0.05 * rows[i - 1].accountsTotal)
    close(rows[i].expensesBy.kids, 10_000, 0.01)
    close(rows[i].plannedSpending, 50_000, 0.01)
  }
})

test("floor and ceiling bound the % rule as shares of planned spending", () => {
  const high = run(plan({ kind: "percent", rate: 0.1, floor: null, ceiling: 1.2 }))
  close(high[1].expensesBy.living, 48_000)
  close(high[1].spendingFactor, 1.2, 1e-9)
  const low = run(plan({ kind: "percent", rate: 0.01, floor: 0.9, ceiling: null }))
  close(low[1].expensesBy.living, 36_000)
})

test("guardrails: cut 10% after a crash, raise 10% after a boom", () => {
  const swing: SimulateOptions["returnFor"] = (_a, index) => (index === 2 ? -0.5 : index === 6 ? 2 : 0)
  const rows = run(plan({ kind: "guardrails", band: 0.2, step: 0.1 }), { returnFor: swing })
  close(rows[1].spendingFactor, 1, 1e-9)
  close(rows[2].spendingFactor, 1, 1e-9)
  close(rows[3].spendingFactor, 0.9, 1e-9)
  assert.ok(rows[4].spendingFactor < 0.9, "keeps cutting while above the guardrail")
  const afterBoom = rows[7].spendingFactor
  assert.ok(afterBoom > rows[6].spendingFactor, `raised after the boom: ${rows[6].spendingFactor} → ${afterBoom}`)
})

test("CAPE rule: (a + b ÷ CAPE) × portfolio; spends as planned without a valuation", () => {
  const rule: SpendingRule = { kind: "cape", a: 0.0175, b: 0.5, floor: null, ceiling: null }
  const withCape = run(plan(rule), { capeFor: () => 25 })
  close(withCape[1].expensesBy.living, (0.0175 + 0.5 / 25) * withCape[0].accountsTotal)
  const without = run(plan(rule))
  close(without[1].expensesBy.living, 40_000, 0.01)
})

test("before retirement the rule doesn't touch spending", () => {
  const base = plan({ kind: "percent", rate: 0.1, floor: null, ceiling: null })
  const later: PlanDocument = {
    ...base,
    milestones: base.milestones.map((m) => (m.kind === "retirement" ? { ...m, timing: { type: "age" as const, personId: base.people[0].id, age: 70 } } : m)),
  }
  const rows = run(later)
  for (const r of rows.filter((r) => r.ages[0] < 70)) assert.equal(r.spendingFactor, 1)
  assert.ok(rows.find((r) => r.ages[0] === 70)!.spendingFactor > 1)
})

test("stress summary: how low the rule took spending (median and worst 10%); none without a rule", () => {
  const cohort = (lowestSpending?: number) => ({ year: 1900, cape: null, avgInflation: null, depletedAge: null, sequence: [1900], netWorth: [1], invested: [1], withdrawalRate: [0], ...(lowestSpending === undefined ? {} : { lowestSpending }) })
  const lows = [1, 0.9, 0.81, 0.73, 0.66, 1, 1, 0.9, 0.9, 1, 0.59]
  const dip = summarize(lows.map((l) => cohort(l)), null).spendingDip!
  close(dip.median, 0.9, 1e-9)
  assert.ok(dip.worst10 < 0.67 && dip.worst10 >= 0.59)
  assert.equal(summarize([cohort(), cohort()], null).spendingDip, null)
})
