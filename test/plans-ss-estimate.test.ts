import test from "node:test"
import assert from "node:assert/strict"
import { bendPoints, estimatePia, parseEarnings, piaFromAime, roughHistory } from "@/lib/plans/ss-estimate"
import { estimatedPia, planEarnings } from "@/lib/plans/ss-plan-earnings"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import type { PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

test("bend points and formula match SSA's 2026 figures", () => {
  assert.deepEqual(bendPoints(1), [1_286, 7_749])
  // 90% of 1,286 + 32% of (5,000 − 1,286), rounded down to the dime.
  assert.equal(piaFromAime(5_000, [1_286, 7_749]), 2_345.8)
})

test("an average earner for 35 years replaces about 45% of the average wage", () => {
  const { pia, counted } = estimatePia(roughHistory(1991, 2025, 69_846.57))
  assert.equal(counted, 35)
  const replacement = (pia * 12) / 69_846.57
  assert.ok(replacement > 0.42 && replacement < 0.47, `${replacement}`)
})

test("fewer than 35 years count as zeros; earnings above the taxable maximum don't count", () => {
  const short = estimatePia(roughHistory(2006, 2025, 69_846.57))
  const full = estimatePia(roughHistory(1991, 2025, 69_846.57))
  assert.ok(short.pia < full.pia)
  const capped = estimatePia([{ year: 2024, amount: 1_000_000 }])
  const atMax = estimatePia([{ year: 2024, amount: 168_600 }])
  assert.equal(capped.pia, atMax.pia)
})

test("parses a pasted SSA earnings record", () => {
  const rows = parseEarnings("Work Year\tTaxed Social Security Earnings\n2019\t$52,000\n2020 55,500.00\nnot a year\n")
  assert.deepEqual(rows, [{ year: 2019, amount: 52_000 }, { year: 2020, amount: 55_500 }])
})

function plan(salaryUntilAge: number): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  const p1 = base.people[0].id
  const ss: PlanIncome = {
    id: "ss", name: "Social Security", kind: "social_security", amount: 0, growth: null, start: { type: "age", personId: p1, age: 67 }, end: { type: "planEnd" },
    taxable: true, oneTime: false, contributions: [], personId: p1, socialSecurity: { pia: 0, claimAge: 67, earnings: roughHistory(2008, 2025, 70_000).map((e) => [e.year, e.amount]) },
  }
  const salary: PlanIncome = {
    id: "sal", name: "Salary", kind: "salary", amount: 70_000, growth: null, start: { type: "planStart" }, end: { type: "age", personId: p1, age: salaryUntilAge },
    taxable: true, oneTime: false, contributions: [], personId: p1,
  }
  return { ...base, settings: { ...base.settings, inflation: 0, taxMode: "flat", incomeTaxRate: 0 }, incomes: [salary, ss], expenses: [] }
}

test("the plan's own salary counts toward the estimate, so retiring earlier lowers the benefit", () => {
  const working = plan(65)
  const early = plan(50)
  assert.equal(planEarnings(working, working.people[0].id).length, 25)
  const ss = (d: PlanDocument) => d.incomes.find((i) => i.id === "ss")!
  assert.ok(estimatedPia(early, ss(early))!.pia < estimatedPia(working, ss(working))!.pia)
  const benefit = (d: PlanDocument) => simulatePlan(d).rows[67 - 40].incomeBy.ss
  assert.ok(Math.abs(benefit(working) - estimatedPia(working, ss(working))!.pia * 12) < 1)
})
