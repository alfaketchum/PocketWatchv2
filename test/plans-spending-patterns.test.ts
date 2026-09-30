import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { applyTypicalPatterns, patternFactor, retirementAge, switchAge, typicalPattern } from "@/lib/plans/plan-spending-patterns"
import type { PlanDocument, PlanExpense, SpendingPattern } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const NOW = 40
const RETIRE = 50

test("one stage runs from now: go-go 120% / 80% / 50%, tapering, rising, custom", () => {
  const f = (pattern: SpendingPattern, age: number) => patternFactor(pattern, age, RETIRE, NOW)
  assert.deepEqual([f({ preset: "gogo" }, 40), f({ preset: "gogo" }, 50), f({ preset: "gogo" }, 60)], [1.2, 0.8, 0.5])
  close(f({ preset: "tapering" }, 50), 0.9)
  assert.equal(f({ preset: "tapering" }, 95), 0.6)
  close(f({ preset: "rising" }, 50), Math.pow(1.025, 10))
  const custom: SpendingPattern = { preset: "custom", phases: [{ fromAge: 70, factor: 0.7 }, { fromAge: 45, factor: 1.3 }] }
  assert.deepEqual([f(custom, 42), f(custom, 50), f(custom, 80)], [1, 1.3, 0.7])
  assert.equal(patternFactor(undefined, 80, RETIRE, NOW), 1)
})

test("two stages: steady now, go-go from retirement", () => {
  const p: SpendingPattern = { preset: "steady", then: { preset: "gogo", at: "retirement" } }
  const f = (age: number) => patternFactor(p, age, RETIRE, NOW)
  assert.deepEqual([f(45), f(50), f(60), f(70)], [1, 1.2, 0.8, 0.5])
  assert.equal(switchAge(p, RETIRE), 50)
  assert.equal(f(90), 0.5)
  // No retirement in the plan: the switch never happens.
  assert.equal(patternFactor(p, 70, null, NOW), 1)
})

test("the second stage carries on from where the first left off; a chosen age works too", () => {
  const p: SpendingPattern = { preset: "tapering", then: { preset: "steady", at: "age", age: 60 } }
  const f = (age: number) => patternFactor(p, age, RETIRE, NOW)
  close(f(59), 0.81)
  close(f(60), 0.8)
  close(f(80), 0.8)
  const custom: SpendingPattern = { preset: "tapering", then: { preset: "custom", at: "age", age: 60, phases: [{ fromAge: 60, factor: 1.5 }] } }
  assert.equal(patternFactor(custom, 65, RETIRE, NOW), 1.5)
})

function plan(expenses: PlanExpense[]): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 90 },
    accounts: [{ ...base.accounts[0], balance: 10_000_000, returnRate: 0 }],
    milestones: base.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing: { type: "age", personId: base.people[0].id, age: RETIRE } } : m)),
    expenses,
  }
}
const line = (name: string, extra: Partial<PlanExpense> = {}): PlanExpense => ({
  id: name, name, category: name, amount: 10_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false, ...extra,
})
const at = (d: PlanDocument, age: number, id: string) => simulatePlan(d).rows.find((r) => r.ages[0] === age)!.expensesBy[id]

test("the engine spends by the pattern; one-time lines and plain lines are unchanged", () => {
  const travel = line("Travel", { pattern: { preset: "steady", then: { preset: "gogo", at: "retirement" } } })
  const d = plan([travel, line("Housing"), line("Wedding", { oneTime: true, pattern: { preset: "gogo" } })])
  assert.equal(retirementAge(d), RETIRE)
  assert.deepEqual([at(d, 49, "Travel"), at(d, 50, "Travel"), at(d, 62, "Travel"), at(d, 72, "Travel")], [10_000, 12_000, 8_000, 5_000])
  assert.equal(at(d, 72, "Housing"), 10_000)
  assert.equal(at(d, 40, "Wedding"), 10_000)
  assert.ok(planDocumentSchema.safeParse(d).success)
})

test("typical retirement pattern: steady now, then by category; healthcare rises from 65", () => {
  assert.deepEqual(typicalPattern({ name: "Travel", category: "Travel" }), { preset: "steady", then: { preset: "gogo", at: "retirement" } })
  assert.deepEqual(typicalPattern({ name: "Healthcare", category: "Healthcare" }), { preset: "steady", then: { preset: "rising", at: "age", age: 65 } })
  assert.equal(typicalPattern({ name: "Housing", category: "Housing" }), undefined)
  assert.deepEqual(
    ["Food & Dining", "Shopping", "Transportation", "Bills & Utilities"].map((c) => typicalPattern({ name: c, category: c })?.then?.preset),
    ["gogo", "tapering", "tapering", undefined],
  )
  const { doc, changed } = applyTypicalPatterns(plan([line("Travel"), line("Housing"), line("Shopping", { oneTime: true })]))
  assert.equal(changed, 1)
  assert.deepEqual(doc.expenses.map((e) => e.pattern?.then?.preset), ["gogo", undefined, undefined])
})
