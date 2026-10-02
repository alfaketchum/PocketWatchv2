import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, PRIMARY_PERSON_ID } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { expandPlan } from "@/lib/plans/plan-expand"
import {
  applyBreak,
  applyCareer,
  applyHome,
  applyMarried,
  applyMove,
  applyWindfall,
  monthlyPayment,
} from "@/lib/plans/milestone-templates"
import { detachMilestone, milestoneUses } from "@/lib/plans/plan-milestone-uses"
import { planDocumentSchema, parsePlanDocument } from "@/lib/plans/plan-schema"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)
let n = 0
const newId = (p: string) => `${p}-${++n}`

const salary: PlanIncome = {
  id: "sal", name: "Salary", kind: "salary", amount: 100_000, growth: 0, start: { type: "planStart" },
  end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [],
}

/** No inflation; 20% flat tax; person aged 35 in 2026; plan to 60. */
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
const row = (d: PlanDocument, year: number) => simulatePlan(d).rows.find((r) => r.year === year)!

test("tax rates change from a date onward", () => {
  const d = plan({ adjustments: [{ id: "a", kind: "taxRates", timing: { type: "year", year: 2030 }, incomeTaxRate: 0.1, capitalGainsRate: 0 }] })
  assert.equal(row(d, 2029).incomeTax, 20_000)
  assert.equal(row(d, 2030).incomeTax, 10_000)
})

test("spending changes scale your own expenses from a date, compounding", () => {
  const d = plan({
    adjustments: [
      { id: "a", kind: "spending", timing: { type: "year", year: 2030 }, percent: -0.25 },
      { id: "b", kind: "spending", timing: { type: "year", year: 2035 }, percent: 0.2 },
    ],
  })
  assert.equal(row(d, 2029).expenses, 40_000)
  assert.equal(row(d, 2030).expenses, 30_000)
  assert.equal(row(d, 2035).expenses, 36_000)
})

test("get married: milestone, partner with income, new tax rates, wedding cost — all tied to the date", () => {
  const d = applyMarried(
    plan(),
    { when: { type: "year", year: 2028 }, partner: { name: "Sam", birthYear: 1992 }, partnerIncome: 60_000, incomeTaxRate: 0.15, capitalGainsRate: 0.15, weddingCost: 30_000 },
    newId,
  )
  assert.ok(planDocumentSchema.safeParse(d).success)
  assert.equal(d.people.length, 2)
  const ms = d.milestones.find((m) => m.name === "Get married")!
  assert.deepEqual(milestoneUses(d, ms.id).sort(), ["Filing status changes", "Sam's salary starts", "Tax rates change", "Wedding starts"].sort())
  assert.equal(row(d, 2027).income, 100_000)
  assert.equal(row(d, 2028).income, 160_000)
  assert.equal(row(d, 2028).incomeTax, 160_000 * 0.15)
  assert.equal(row(d, 2028).expensesBy[d.expenses.find((e) => e.name === "Wedding")!.id], 30_000)
  const filing = (d.adjustments ?? []).find((a) => a.kind === "filingStatus")
  assert.ok(filing && filing.kind === "filingStatus" && filing.status === "joint" && filing.origin === ms.id)
})

test("buy a home: asset plus a linked mortgage with an amortized payment", () => {
  assert.ok(Math.abs(monthlyPayment(400_000, 0.06, 360) - 2398.2) < 0.1)
  const d = applyHome(plan(), { name: "House", when: { type: "year", year: 2030 }, price: 500_000, payWith: "loan", downPayment: 100_000, rate: 0.06, termYears: 30, appreciation: 0.03 }, newId)
  assert.equal(d.assets[0].name, "House")
  const mortgage = expandPlan(d).debts[0]
  assert.equal(mortgage.balance, 400_000)
  assert.equal(mortgage.assetId, d.assets[0].id)
  assert.equal(mortgage.kind, "mortgage")
  assert.ok(Math.abs(mortgage.monthlyPayment - 2398.2) < 0.1)
})

test("career change ends the old salary and starts the new one at the milestone", () => {
  const d = applyCareer(plan(), { incomeId: "sal", when: { type: "year", year: 2030 }, name: "New job", amount: 150_000 }, newId)
  assert.equal(row(d, 2029).income, 100_000)
  assert.equal(row(d, 2030).income, 150_000)
})

test("career break pauses the salary and resumes it", () => {
  const d = applyBreak(plan(), { incomeId: "sal", startYear: 2030, years: 2 }, newId)
  assert.deepEqual([2029, 2030, 2031, 2032].map((y) => row(d, y).income), [100_000, 0, 0, 100_000])
})

test("move and windfall", () => {
  const moved = applyMove(plan(), { name: "Move to Austin", when: { type: "year", year: 2030 }, percent: -0.1 }, newId)
  assert.equal(row(moved, 2030).expenses, 36_000)
  const lucky = applyWindfall(plan(), { name: "Inheritance", when: { type: "year", year: 2031 }, amount: 200_000, taxable: false }, newId)
  assert.equal(row(lucky, 2031).income, 300_000)
  assert.equal(row(lucky, 2032).income, 100_000)
})

test("deleting a milestone pins what pointed at it to that year", () => {
  const d = applyCareer(plan(), { incomeId: "sal", when: { type: "age", personId: PRIMARY_PERSON_ID, age: 40 }, name: "New job", amount: 150_000 }, newId)
  const ms = d.milestones.find((m) => m.name === "New job")!
  const out = detachMilestone(d, ms.id)
  assert.ok(!out.milestones.some((m) => m.id === ms.id))
  assert.deepEqual(out.incomes[0].end, { type: "year", year: 2031 })
  assert.equal(row(out, 2031).income, 150_000)
})

test("plans saved before adjustments existed still load", () => {
  const { adjustments: _a, ...old } = blankPlanDocument(NOW)
  assert.deepEqual(parsePlanDocument(old, blankPlanDocument(NOW))?.adjustments, [])
})

test("move: a new state is a change tied to the move; staying adds none", () => {
  const moved = applyMove(plan(), { name: "Move", when: { type: "year", year: 2030 }, percent: -0.1, state: "TX" }, newId)
  const ms = moved.milestones.find((m) => m.name === "Move")!
  assert.deepEqual(milestoneUses(moved, ms.id).sort(), ["Spending changes", "State changes"])
  assert.ok(planDocumentSchema.safeParse(moved).success)
  const stayed = applyMove(plan(), { name: "Move", when: { type: "year", year: 2030 }, percent: -0.1 }, newId)
  assert.deepEqual((stayed.adjustments ?? []).map((a) => a.kind), ["spending"])
})

test("a home bought at a milestone gets no second 'Buy …' marker; one bought at an age does", () => {
  const base = blankPlanDocument(new Date(2026, 0, 15), 30)
  const home = (id: string, start: PlanDocument["assets"][number]["start"]) => ({
    id, name: id, kind: "home" as const, value: 300_000, appreciation: 0.03, start, end: { type: "planEnd" as const }, acquired: "purchase" as const,
  })
  const doc: PlanDocument = {
    ...base,
    milestones: [...base.milestones, { id: "ms-home", name: "Buy first home", kind: "custom", timing: { type: "age", personId: PRIMARY_PERSON_ID, age: 36 } }],
    assets: [home("Condo", { type: "milestone", milestoneId: "ms-home" }), home("House", { type: "age", personId: PRIMARY_PERSON_ID, age: 45 })],
  }
  const names = expandPlan(doc).milestones.map((m) => m.name)
  assert.ok(names.includes("Buy first home"))
  assert.ok(!names.includes("Buy Condo"))
  assert.ok(names.includes("Buy House"))
})
