import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { irmaaYear, lookbackMagi, medicareEnrollees } from "@/lib/plans/engine/engine-irmaa"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { rowInTodaysDollars } from "@/lib/plans/plan-dollars"
import { rowTaxes } from "@/lib/plans/plan-row-taxes"
import { irmaaLine, irmaaTierFor } from "@/lib/plans/tax/irmaa-2026"
import type { PlanAccount, PlanConversion, PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`)
const YEAR = (tier: number, people = 1) => people * 12 * [0, 95.7, 240.4, 385.0, 529.6, 578.0][tier]

const account = (id: string, taxTreatment: PlanAccount["taxTreatment"], balance: number): PlanAccount => ({
  id, name: id, taxTreatment, balance, costBasis: null, returnRate: 0, owner: null, source: null,
})

const pension = (amount: number, extra: Partial<PlanIncome> = {}): PlanIncome => ({
  id: "pension", name: "Pension", kind: "pension", amount, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" },
  taxable: true, oneTime: false, contributions: [], ...extra,
})

/** Single, 2026 brackets, no inflation; `age` at plan start (born January). */
function plan(age: number, patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), age)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: null, inflation: 0, cashBuffer: 0, protectBuffer: false, endAge: age + 6 },
    accounts: [account("cash", "cash", 2_000_000), account("ira", "traditional", 2_000_000), account("roth", "roth", 0)],
    incomes: [],
    expenses: [],
    milestones: [],
    ...patch,
  }
}

test("tier lines: lower lines indexed; the top line fixed through 2028, then indexed", () => {
  assert.equal(irmaaTierFor(109_000, "single", 1, 2026), 0)
  assert.equal(irmaaTierFor(109_001, "single", 1, 2026), 1)
  assert.equal(irmaaTierFor(150_000, "single", 1, 2026), 2)
  assert.equal(irmaaTierFor(500_001, "single", 1, 2026), 5)
  assert.equal(irmaaTierFor(300_000, "joint", 1, 2026), 2)
  close(irmaaLine("single", 0, 1.1, 2030), 119_900, 0.01)
  assert.equal(irmaaLine("single", 4, 1.0609, 2028), 500_000)
  // 3% a year from 2026: index 1.03^4 in 2030; the top line grows only 2028 → 2030.
  close(irmaaLine("single", 4, 1.03 ** 4, 2030), 500_000 * 1.03 ** 2, 0.5)
})

test("surcharge: per person on Medicare, by the tier of MAGI two years back", () => {
  const d = plan(66)
  assert.deepEqual(irmaaYear(d, "single", 2026, 1, 150_000), { tier: 2, surcharge: YEAR(2) })
  assert.equal(irmaaYear(plan(60), "single", 2026, 1, 150_000).surcharge, 0)
  const couple = { ...d, people: [...d.people, { id: "p2", name: "Sam", birthYear: 1958, birthMonth: 1 }] }
  assert.equal(medicareEnrollees(couple, "joint", 2026), 2)
  close(irmaaYear(couple, "joint", 2026, 1, 300_000).surcharge, YEAR(2, 2))
  assert.equal(lookbackMagi([10, 20, 30], 4, 99), 30)
  assert.equal(lookbackMagi([10], 1, 99), 99)
})

test("the engine charges it from the plan's own income two years earlier, counted with taxes", () => {
  const rows = simulatePlan(plan(66, { incomes: [pension(150_000)] })).rows
  close(rows[0].irmaaSurcharge, YEAR(2))
  assert.equal(rows[0].irmaaTier, 2)
  close(rows[3].irmaaSurcharge, YEAR(2))
  for (const r of rows) close(rowTaxes(r), r.ordinaryIncomeTax + r.shortGainsTax + r.longGainsTax + r.payrollTax + r.earlyWithdrawalPenalty + r.irmaaSurcharge, 0.01)
  assert.equal(simulatePlan(plan(66, { incomes: [pension(60_000)] })).rows[0].irmaaSurcharge, 0)
})

test("under 65 nothing is charged; a conversion at 63 shows up at 65", () => {
  const conversion: PlanConversion = {
    id: "c", name: "Convert", mode: "fixed", amount: 300_000, amountBasis: "nominal", start: { type: "planStart" }, end: { type: "year", year: 2027 },
    sourceAccountIds: ["ira"], destAccountId: "roth", caps: {}, payTaxFrom: "cashFlow",
  }
  const rows = simulatePlan(plan(63, { incomes: [pension(50_000)], conversions: [conversion] })).rows
  assert.equal(rows[0].irmaaSurcharge, 0)
  assert.equal(rows[1].irmaaSurcharge, 0)
  assert.equal(rows[2].irmaaTier, 4)
  assert.equal(rows[3].irmaaSurcharge, 0)
})

test("today's dollars scale it like any flow", () => {
  const d = plan(66, { incomes: [pension(150_000)], settings: { ...plan(66).settings, inflation: 0.03 } })
  const row = simulatePlan(d).rows[2]
  close(rowInTodaysDollars(row, 0.03).irmaaSurcharge, row.irmaaSurcharge / 1.03 ** 2, 0.01)
})
