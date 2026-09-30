import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { applyTypicalPatterns, patternFactor, retirementAge, typicalPattern } from "@/lib/plans/plan-spending-patterns"
import type { PlanDocument, PlanExpense, SpendingPattern } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const p = (preset: SpendingPattern["preset"], phases?: SpendingPattern["phases"]): SpendingPattern => ({ preset, phases })

test("go-go: nothing changes before retirement, then 120% / 80% / 50%", () => {
  assert.equal(patternFactor(p("gogo"), 49, 50), 1)
  assert.equal(patternFactor(p("gogo"), 50, 50), 1.2)
  assert.equal(patternFactor(p("gogo"), 60, 50), 0.8)
  assert.equal(patternFactor(p("gogo"), 75, 50), 0.5)
  assert.equal(patternFactor(p("gogo"), 75, null), 1)
})

test("tapering, rising, custom and steady", () => {
  close(patternFactor(p("tapering"), 60, 50), 0.9)
  assert.equal(patternFactor(p("tapering"), 95, 50), 0.6)
  assert.equal(patternFactor(p("rising"), 60, 40), 1)
  close(patternFactor(p("rising"), 75, 40), Math.pow(1.025, 10))
  assert.equal(patternFactor(p("rising"), 120, 40), 2.5)
  const custom = p("custom", [{ fromAge: 70, factor: 0.7 }, { fromAge: 55, factor: 1.3 }])
  assert.deepEqual([patternFactor(custom, 50, 60), patternFactor(custom, 60, 60), patternFactor(custom, 80, 60)], [1, 1.3, 0.7])
  assert.equal(patternFactor(undefined, 80, 50), 1)
})

function plan(expenses: PlanExpense[]): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 90 },
    accounts: [{ ...base.accounts[0], balance: 10_000_000, returnRate: 0 }],
    milestones: base.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing: { type: "age", personId: base.people[0].id, age: 50 } } : m)),
    expenses,
  }
}
const line = (name: string, extra: Partial<PlanExpense> = {}): PlanExpense => ({
  id: name, name, category: name, amount: 10_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false, ...extra,
})
const at = (d: PlanDocument, age: number, id: string) => simulatePlan(d).rows.find((r) => r.ages[0] === age)!.expensesBy[id]

test("the engine spends by the pattern, anchored on the plan's retirement age", () => {
  const d = plan([line("Travel", { pattern: p("gogo") }), line("Housing"), line("Wedding", { oneTime: true, pattern: p("gogo") })])
  assert.equal(retirementAge(d), 50)
  assert.deepEqual([at(d, 49, "Travel"), at(d, 50, "Travel"), at(d, 62, "Travel"), at(d, 72, "Travel")], [10_000, 12_000, 8_000, 5_000])
  assert.equal(at(d, 72, "Housing"), 10_000)
  assert.equal(at(d, 40, "Wedding"), 10_000)
  assert.ok(planDocumentSchema.safeParse(d).success)
})

test("typical retirement pattern by category; one-time lines left alone", () => {
  assert.deepEqual(
    ["Travel", "Food & Dining", "Healthcare", "Shopping", "Transportation", "Housing", "Bills & Utilities"].map((c) => typicalPattern({ name: c, category: c })),
    ["gogo", "gogo", "rising", "tapering", "tapering", "steady", "steady"],
  )
  const { doc, changed } = applyTypicalPatterns(plan([line("Travel"), line("Housing"), line("Shopping", { oneTime: true })]))
  assert.equal(changed, 1)
  assert.deepEqual(doc.expenses.map((e) => e.pattern?.preset), ["gogo", undefined, undefined])
})
