import test from "node:test"
import assert from "node:assert/strict"
import { claimFactor, fullRetirementAge, yearlyBenefit } from "@/lib/plans/social-security"

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`)

test("full retirement age by birth year", () => {
  assert.equal(fullRetirementAge(1950), 66)
  close(fullRetirementAge(1957), 66.5)
  assert.equal(fullRetirementAge(1990), 67)
})

test("SSA's published factors: 70% at 62 and 124% at 70 for FRA 67; 75% at 62 for FRA 66", () => {
  close(claimFactor(1990, 62), 0.7)
  close(claimFactor(1990, 67), 1)
  close(claimFactor(1990, 70), 1.24)
  close(claimFactor(1990, 65), 1 - 24 * (5 / 9 / 100))
  close(claimFactor(1950, 62), 0.75)
  close(claimFactor(1950, 70), 1.32)
  close(yearlyBenefit(2_000, 1990, 70), 2_000 * 12 * 1.24)
})

import { applyPension, applySocialSecurity } from "@/lib/plans/income-templates"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { generatedMilestones } from "@/lib/plans/plan-milestones"

test("Social Security and pensions land on Income and mark the timeline", () => {
  let n = 0
  const newId = (p: string) => `${p}-${++n}`
  const doc = blankPlanDocument(new Date(2026, 0, 15), 40)
  const person = doc.people[0]
  const withSs = applySocialSecurity(doc, { personId: person.id, monthlyAtFra: 2_000, claimAge: 70 }, newId)
  const ss = withSs.incomes.at(-1)!
  assert.equal(ss.kind, "social_security")
  assert.equal(ss.amount, 29_760)
  assert.deepEqual(ss.start, { type: "age", personId: person.id, age: 70 })
  const withPension = applyPension(withSs, { name: "Teacher pension", personId: person.id, amount: 30_000, startAge: 62, raises: false }, newId)
  assert.equal(withPension.incomes.at(-1)!.growth, 0)
  const marks = generatedMilestones(withPension).filter((m) => m.kind === "income").map((m) => m.name)
  assert.deepEqual(marks, ["Claim Social Security", "Teacher pension starts"])
})
