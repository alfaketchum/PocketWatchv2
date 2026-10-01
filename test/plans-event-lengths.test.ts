import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { applyBreak, applyDivorce } from "@/lib/plans/milestone-templates"
import { applyElderCare } from "@/lib/plans/elder-care"
import { detachMilestone } from "@/lib/plans/plan-milestone-uses"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanDocument, Timing } from "@/lib/plans/plan-types"

let n = 0
const newId = (p: string) => `${p}-${++n}`

function base(): PlanDocument {
  const doc = blankPlanDocument(new Date(2026, 0, 15), 35)
  return {
    ...doc,
    incomes: [{ id: "sal", name: "Salary", kind: "salary", amount: 100_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }],
  }
}
const yearOf = (doc: PlanDocument, t: Timing) => doc.settings.startYear + (resolveTiming(t, timingContext(doc)) ?? NaN)
const milestone = (doc: PlanDocument, name: string) => doc.milestones.find((m) => m.name === name)!
const moveTo = (doc: PlanDocument, id: string, year: number): PlanDocument => ({
  ...doc,
  milestones: doc.milestones.map((m) => (m.id === id ? { ...m, timing: { type: "year", year } } : m)),
})

test("a 3-year career break stays 3 years when its start moves", () => {
  const doc = applyBreak(base(), { incomeId: "sal", startYear: 2030, years: 3 }, newId)
  const start = milestone(doc, "Career break")
  assert.equal(yearOf(doc, milestone(doc, "Back to work").timing), 2033)
  const moved = moveTo(doc, start.id, 2032)
  assert.equal(yearOf(moved, milestone(moved, "Back to work").timing), 2035)
  assert.ok(planDocumentSchema.safeParse(moved).success)
})

test("elder care keeps its length, and so does divorce support", () => {
  const care = applyElderCare(base(), { parentName: "Mom", arrangement: "moveIn", startYear: 2030, years: 4, yearlyCost: 12_000, oneTimeCost: 0, aidePerYear: 0, payer: "you", parentShare: 0, workCut: null }, "elderly_woman", newId)
  const begins = milestone(care, "Mom's care begins")
  const careMoved = moveTo(care, begins.id, 2035)
  assert.equal(yearOf(careMoved, milestone(careMoved, "Mom's care ends").timing), 2039)

  const divorced = applyDivorce(base(), { when: { type: "year", year: 2030 }, endIncomeIds: [], exShare: 0.5, legalCost: 0, supportPerYear: 12_000, supportYears: 5, incomeTaxRate: 0.2, capitalGainsRate: 0.15 }, newId)
  const ms = divorced.milestones.find((m) => m.timing.type === "year" && m.timing.year === 2030)!
  const moved = moveTo(divorced, ms.id, 2033)
  const support = moved.expenses.find((e) => e.name.startsWith("Alimony"))!
  assert.equal(yearOf(moved, support.end), 2038)
})

test("deleting a break but keeping its items pins each at its own year", () => {
  const doc = applyBreak(base(), { incomeId: "sal", startYear: 2030, years: 3 }, newId)
  const kept = detachMilestone(doc, milestone(doc, "Career break").id)
  const back = milestone(kept, "Back to work")
  assert.deepEqual(back.timing, { type: "year", year: 2033 })
})
