import test from "node:test"
import assert from "node:assert/strict"
import { applyElderCare, careDefaults, surveyToToday, yourShare, type ElderCareInput } from "@/lib/plans/elder-care"
import { careCostsFor, NATIONAL_CARE_COSTS, STATE_CARE_COSTS } from "@/lib/plans/elder-care-costs-2024"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import type { PlanDocument } from "@/lib/plans/plan-types"

let n = 0
const newId = (p: string) => `${p}-${++n}`

function plan(): PlanDocument {
  const doc = blankPlanDocument(new Date(2026, 0, 15), 45)
  return {
    ...doc,
    settings: { ...doc.settings, taxMode: "flat", incomeTaxRate: 0, capitalGainsRate: 0, inflation: 0 },
    incomes: [{ id: "sal", name: "Salary", kind: "other", amount: 100_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: false, oneTime: false, contributions: [] }],
    expenses: [],
  }
}

const input = (over: Partial<ElderCareInput> = {}): ElderCareInput => ({
  parentName: "Mom", arrangement: "nursingHome", startYear: 2030, years: 3, yearlyCost: 120_000, oneTimeCost: 0, aidePerYear: 0, payer: "you", parentShare: 0, workCut: null, ...over,
})

test("state costs: every state and DC, national fallback, and states differ", () => {
  assert.equal(Object.keys(STATE_CARE_COSTS).length, 51)
  assert.equal(careCostsFor(null), NATIONAL_CARE_COSTS)
  assert.ok(careCostsFor("NJ").nursingHome > careCostsFor("TX").nursingHome)
  assert.equal(careDefaults("nursingHome", "NJ").yearly, STATE_CARE_COSTS.NJ.nursingHome)
  assert.equal(careDefaults("hybrid", "TX").yearly, STATE_CARE_COSTS.TX.assistedLiving)
})

test("who pays: they pay all, part or none of it", () => {
  assert.equal(yourShare({ payer: "parent", parentShare: 0 }), 0)
  assert.equal(yourShare({ payer: "shared", parentShare: 0.3 }), 0.7)
  assert.equal(yourShare({ payer: "you", parentShare: 0.9 }), 1)
  assert.equal(applyElderCare(plan(), input({ payer: "parent" }), "x", newId).expenses.length, 0)
})

test("your share runs for the care years; cutting back work pays a share, then resumes", () => {
  const doc = applyElderCare(plan(), input({ payer: "shared", parentShare: 0.5, workCut: { incomeId: "sal", keep: 0.4 } }), "x", newId)
  const rows = simulatePlan(doc).rows
  const year = (y: number) => rows[y - 2026]
  assert.equal(year(2029).expenses, 0)
  assert.equal(year(2030).expenses, 60_000)
  assert.equal(year(2032).expenses, 60_000)
  assert.equal(year(2033).expenses, 0)
  assert.equal(year(2030).income, 40_000)
  assert.equal(year(2033).income, 100_000)
})

test("survey dollars are brought to the plan's today's dollars at its inflation", () => {
  const uplift = surveyToToday({ inflation: 0.03, startYear: 2026 })
  assert.ok(Math.abs(uplift - 1.03 ** 2) < 1e-12)
  assert.equal(careDefaults("nursingHome", "NJ", uplift).yearly, Math.round(STATE_CARE_COSTS.NJ.nursingHome * uplift))
})
