import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { claimFactor, survivorBenefit } from "@/lib/plans/social-security"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`)

/** Two people born 1966 (age 60 in 2026, full retirement age 67), no inflation or taxes. */
function couple(incomes: PlanIncome[], over: Partial<PlanDocument["settings"]> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 60)
  return {
    ...base,
    people: [
      { ...base.people[0], id: "p1", birthYear: 1966, birthMonth: 1 },
      { id: "p2", name: "Sam", birthYear: 1966, birthMonth: 1 },
    ],
    settings: { ...base.settings, inflation: 0, taxMode: "flat", incomeTaxRate: 0, capitalGainsRate: 0, filingStatus: "joint", endAge: 80, ...over },
    incomes,
    expenses: [],
    milestones: [],
  }
}

const ss = (id: string, personId: string, pia: number, claimAge: number): PlanIncome => ({
  id, name: id, kind: "social_security", amount: 0, growth: null, start: { type: "age", personId, age: claimAge }, end: { type: "planEnd" },
  taxable: true, oneTime: false, contributions: [], personId, socialSecurity: { pia, claimAge },
})
const salary = (personId: string, amount: number, untilAge: number): PlanIncome => ({
  id: `sal-${personId}`, name: "Salary", kind: "salary", amount, growth: null, start: { type: "planStart" }, end: { type: "age", personId, age: untilAge },
  taxable: true, oneTime: false, contributions: [], personId,
})
const at = (doc: PlanDocument, age: number, id: string) => simulatePlan(doc).rows[age - 60].incomeBy[id] ?? 0

test("own benefit: SSA's factor for the claiming age", () => {
  close(at(couple([ss("a", "p1", 2_000, 62)]), 62, "a"), 2_000 * 12 * 0.7)
  close(at(couple([ss("a", "p1", 2_000, 70)]), 70, "a"), 2_000 * 12 * 1.24)
})

test("spousal top-up: half the partner's PIA beyond your own, once both have filed and only while married", () => {
  const doc = couple([ss("a", "p1", 2_000, 67), ss("b", "p2", 600, 67)])
  close(at(doc, 67, "b"), 600 * 12 + (1_000 - 600) * 12)
  close(at(doc, 67, "a"), 2_000 * 12)
  close(at({ ...doc, settings: { ...doc.settings, filingStatus: "single" } }, 67, "b"), 600 * 12)
})

test("earnings test: claiming at 62 while earning withholds benefits, credited back at full retirement age", () => {
  const doc = couple([ss("a", "p1", 2_000, 62), salary("p1", 54_480, 65)])
  const benefit = 2_000 * 12 * 0.7
  close(at(doc, 62, "a"), benefit - 15_000)
  close(at(doc, 65, "a"), benefit)
  const months = 3 * (15_000 / benefit) * 12
  close(at(doc, 67, "a"), 2_000 * 12 * claimFactor(1966, 62 + months / 12))
  assert.ok(at(doc, 67, "a") > benefit, "the withheld months raise the benefit later")
})

test("trust fund shortfall: benefits paid at a share from a year on", () => {
  const doc = couple([ss("a", "p1", 2_000, 67)], { ssCut: { share: 0.22, fromYear: 2033 } })
  close(at(doc, 67, "a"), 2_000 * 12 * 0.78)
})

test("survivor benefit: their benefit with delay credits, at least 82.5% of PIA, reduced before your FRA", () => {
  close(survivorBenefit({ pia: 2_000, claimAge: 70, birthYear: 1966 }, 1966, 72), 2_000 * 1.24 * 12)
  close(survivorBenefit({ pia: 2_000, claimAge: 62, birthYear: 1966 }, 1966, 72), 2_000 * 0.825 * 12)
  close(survivorBenefit({ pia: 2_000, claimAge: 67, birthYear: 1966 }, 1966, 60), 2_000 * 0.715 * 12)
})

test("without 40 credits of their own, a spouse still gets the spousal benefit: half the partner's PIA", () => {
  const short = { ...ss("b", "p2", 0, 67), socialSecurity: { pia: 0, claimAge: 67, earnings: [[2020, 30_000], [2021, 30_000]] as [number, number][] } }
  const doc = couple([ss("a", "p1", 2_000, 67), short])
  close(at(doc, 67, "b"), 1_000 * 12)
})
