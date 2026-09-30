import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { spendingImpact } from "@/lib/plans/plan-spending-impact"
import type { PlanDocument } from "@/lib/plans/plan-types"

function plan(withPattern: boolean): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0.03, cashBuffer: 0, endAge: 90 },
    accounts: [{ ...base.accounts[0], balance: 5_000_000, returnRate: 0 }],
    milestones: base.milestones.map((m) => (m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing: { type: "age", personId: base.people[0].id, age: 50 } } : m)),
    expenses: [{
      id: "travel", name: "Travel", category: "Travel", amount: 10_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false,
      ...(withPattern ? { pattern: { preset: "steady" as const, then: { preset: "gogo" as const, at: "retirement" as const } } } : {}),
    }],
  }
}

test("impact: today's dollars, with patterns vs all steady", () => {
  const i = spendingImpact(plan(true))
  const at = (age: number) => i.points.find((p) => p.age === age)!
  assert.ok(Math.abs(at(45).withPatterns - 10_000) < 0.01)
  assert.ok(Math.abs(at(52).withPatterns - 12_000) < 0.01)
  assert.ok(Math.abs(at(52).steady - 10_000) < 0.01)
  assert.equal(i.retireAge, 50)
  const flat = spendingImpact(plan(false))
  assert.ok(Math.abs(flat.lifetime.withPatterns - flat.lifetime.steady) < 0.01)
  assert.ok(i.lifetime.withPatterns < i.lifetime.steady, "go-go's later cuts outweigh its early bump over 40 years")
})
