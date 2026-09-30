import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, FI_MILESTONE_ID, FI_SAFE_WITHDRAWAL_RATE } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { fiMilestone } from "@/lib/plans/plan-fi-milestone"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)

const salary: PlanIncome = {
  id: "sal", name: "Salary", kind: "salary", amount: 100_000, growth: 0, start: { type: "planStart" },
  end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [],
}

/** No inflation; 20% flat tax; person aged 35 in 2026; plan to 60; $40k/yr spending. */
function plan(patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0.2, capitalGainsRate: 0.15, cashBuffer: 0, endAge: 60 },
    incomes: [salary],
    expenses: [{ id: "live", name: "Living", category: null, amount: 40_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    ...patch,
  }
}

test("FI milestone: target is average yearly spending / 3.5%, reached when accounts cross it", () => {
  const d = plan()
  const fi = fiMilestone(d)!
  assert.equal(fi.averageExpenses, 40_000)
  assert.ok(Math.abs(fi.target - 40_000 / FI_SAFE_WITHDRAWAL_RATE) < 1e-6)
  assert.equal(fi.reached, true)
  assert.equal(fi.milestone.id, FI_MILESTONE_ID)
  assert.equal(fi.milestone.kind, "custom")
  // The milestone year matches an independent walk of the simulated rows.
  const hit = simulatePlan(d).rows.find((r) => r.accountsTotal >= fi.target)!
  assert.deepEqual(fi.milestone.timing, { type: "year", year: hit.year })
})

test("FI milestone is flagged not reached when accounts never cover it", () => {
  const d = plan({ expenses: [{ ...plan().expenses[0], amount: 95_000 }] })
  const fi = fiMilestone(d)!
  assert.equal(fi.averageExpenses, 95_000)
  assert.equal(fi.reached, false)
})

test("FI milestone is null without any spending", () => {
  assert.equal(fiMilestone(plan({ expenses: [] })), null)
})
