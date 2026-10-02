import test from "node:test"
import assert from "node:assert/strict"
import { federalDeduction, federalTax, seniorDeduction, taxBase, type TaxSituation } from "@/lib/plans/tax/tax-calc"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import type { PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const at = (status: TaxSituation["status"], seniors: number, year = 2026): TaxSituation => ({ status, state: null, index: 1, year, seniors })
const wages = (ordinary: number) => taxBase({ ordinary })

test("2026 standard deduction adds $2,050 for a single filer 65+, $1,650 per spouse (Rev. Proc. 2025-32)", () => {
  assert.equal(federalDeduction(wages(50_000), at("single", 0), 0).amount, 16_100)
  assert.equal(federalDeduction(wages(50_000), at("single", 1), 0).amount, 18_150)
  assert.equal(federalDeduction(wages(50_000), at("joint", 1), 0).amount, 33_850)
  assert.equal(federalDeduction(wages(50_000), at("joint", 2), 0).amount, 35_500)
})

test("senior deduction: $6,000 per filer 65+, less 6% of MAGI over $75k / $150k, only 2025–2028", () => {
  assert.equal(seniorDeduction(wages(60_000), at("single", 1)), 6_000)
  close(seniorDeduction(wages(100_000), at("single", 1)), 6_000 - 0.06 * 25_000)
  assert.equal(seniorDeduction(wages(175_000), at("single", 1)), 0)
  assert.equal(seniorDeduction(wages(150_000), at("joint", 2)), 12_000)
  close(seniorDeduction(wages(200_000), at("joint", 2)), 2 * (6_000 - 0.06 * 50_000))
  assert.equal(seniorDeduction(wages(250_000), at("joint", 2)), 0)
  assert.equal(seniorDeduction(wages(60_000), at("single", 1, 2029)), 0)
  assert.equal(seniorDeduction(wages(60_000), at("single", 0)), 0)
})

test("both lower federal tax by the deduction times the marginal rate", () => {
  // $60k single: still in the 12% bracket after either deduction.
  const young = federalTax(wages(60_000), at("single", 0))
  const senior = federalTax(wages(60_000), at("single", 1))
  close(young - senior, (2_050 + 6_000) * 0.12, 1)
})

test("in a plan, the deduction steps up the year you turn 65 and the senior part ends after 2028", () => {
  const base = blankPlanDocument(new Date(2026, 0, 15), 63)
  const doc: PlanDocument = {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: null, filingStatus: "single", inflation: 0, endAge: 70 },
    incomes: [{ id: "p", name: "Pension", kind: "pension", amount: 40_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }],
  }
  const rows = simulatePlan(doc).rows
  const byYear = (y: number) => rows.find((r) => r.year === y)!.deduction!
  const turns65 = doc.people[0].birthYear + 65
  assert.equal(byYear(turns65 - 1).amount, 16_100)
  assert.equal(byYear(turns65 - 1).senior, 0)
  assert.equal(byYear(turns65).amount, 18_150)
  assert.equal(byYear(turns65).senior, turns65 <= 2028 ? 6_000 : 0)
  assert.equal(byYear(2029).senior, 0)
})
