import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { diffPlanInputs } from "@/lib/plans/plan-diff"
import { summarizePlan } from "@/lib/plans/plan-summary"
import { applyWhatIf, baselineOf, EMPTY_WHAT_IF, isWhatIfEmpty, whatIfFromQuery, whatIfToQuery, type WhatIf } from "@/lib/plans/plan-what-if"
import type { PlanDocument, PlanExpense, PlanIncome } from "@/lib/plans/plan-types"

const base = blankPlanDocument(new Date(2026, 0, 1), 40)
const rent: PlanExpense = { id: "rent", name: "Rent", category: null, amount: 30_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }
const ss: PlanIncome = {
  id: "ss",
  name: "Social Security",
  kind: "social_security",
  amount: 20_000,
  growth: null,
  start: { type: "age", personId: base.people[0].id, age: 67 },
  end: { type: "planEnd" },
  taxable: true,
  oneTime: false,
  contributions: [],
  socialSecurity: { pia: 2_000, claimAge: 67 },
}
const doc: PlanDocument = { ...base, expenses: [rent], incomes: [...base.incomes, ss] }
const apply = (w: Partial<WhatIf>) => applyWhatIf(doc, { ...EMPTY_WHAT_IF, ...w })

test("no dials moved: the same plan, and nothing to list", () => {
  assert.equal(apply({}), doc)
  const b = baselineOf(doc)
  const atBaseline = apply({ retireAge: b.retireAge ?? undefined, inflation: b.inflation, ssClaimAge: b.ssClaimAge ?? undefined })
  assert.deepEqual(diffPlanInputs(doc, atBaseline), [])
})

test("retire dial moves the retirement milestone and the summary's retirement age", () => {
  const b = baselineOf(doc)
  assert.ok(b.retireAge !== null)
  const earlier = apply({ retireAge: b.retireAge! - 5 })
  assert.equal(summarizePlan(earlier, simulatePlan(earlier)).retirementAge, b.retireAge! - 5)
  assert.deepEqual(diffPlanInputs(doc, earlier).map((g) => g.key), ["milestones"])
})

test("spending −10% scales recurring expenses only", () => {
  const once: PlanExpense = { ...rent, id: "car", name: "Car", amount: 40_000, oneTime: true }
  const out = applyWhatIf({ ...doc, expenses: [rent, once] }, { events: [], spendPct: -0.1 })
  assert.deepEqual(out.expenses.map((e) => e.amount), [27_000, 40_000])
})

test("return shift moves every non-cash account, not cash", () => {
  const out = apply({ returnShift: 0.01 })
  out.accounts.forEach((a, i) => {
    const before = doc.accounts[i].returnRate
    assert.equal(a.returnRate, a.taxTreatment === "cash" ? before : Math.round((before + 0.01) * 1e6) / 1e6)
  })
})

test("inflation dial sets a custom rate", () => {
  const out = apply({ inflation: 0.04 })
  assert.equal(out.settings.inflation, 0.04)
  assert.equal(out.settings.inflationMode, "custom")
})

test("claim age changes Social Security only", () => {
  const out = apply({ ssClaimAge: 70 })
  assert.equal(out.incomes.find((i) => i.id === "ss")?.socialSecurity?.claimAge, 70)
  assert.deepEqual(diffPlanInputs(doc, out).map((g) => g.key), ["incomes"])
})

test("a windfall is one-time income in its year; a purchase a one-time expense", () => {
  const out = apply({
    events: [
      { id: "1", kind: "windfall", year: 2030, amount: 200_000, label: "Inheritance", taxable: false },
      { id: "2", kind: "purchase", year: 2032, amount: 60_000, label: "Boat", taxable: false },
    ],
  })
  const windfall = out.incomes.at(-1)!
  assert.equal(windfall.name, "Inheritance")
  assert.equal(windfall.oneTime, true)
  assert.deepEqual(windfall.start, { type: "year", year: 2030 })
  assert.equal(out.expenses.at(-1)!.name, "Boat")
  const rows = simulatePlan(out).rows
  const plain = simulatePlan(doc).rows
  const at = (rs: typeof rows, year: number) => rs.find((r) => r.year === year)!
  assert.ok(at(rows, 2030).income > at(plain, 2030).income + 150_000)
})

test("dials survive the URL, clamped", () => {
  const w: WhatIf = {
    retireAge: 60,
    spendPct: -0.15,
    returnShift: -0.01,
    inflation: 0.035,
    ssClaimAge: 70,
    events: [{ id: "ev0", kind: "windfall", year: 2031, amount: 50_000, label: "Bonus ~ Q4", taxable: true }],
  }
  assert.deepEqual(whatIfFromQuery(whatIfToQuery(w)), w)
  const wild = whatIfFromQuery(new URLSearchParams("retire=20&spend=900&ret=-50&infl=40&ss=99&ev=x~1~2~0~bad"))
  assert.deepEqual(wild, { retireAge: 40, spendPct: 0.5, returnShift: -0.03, inflation: 0.06, ssClaimAge: 70, events: [] })
  assert.equal(isWhatIfEmpty(whatIfFromQuery(new URLSearchParams(""))), true)
})

test("a what-if with every dial moved still saves (passes the plan schema)", async () => {
  const { planDocumentSchema } = await import("@/lib/plans/plan-schema")
  const b = baselineOf(doc)
  const out = apply({
    retireAge: b.retireAge! + 2,
    spendPct: 0.2,
    returnShift: -0.005,
    inflation: 0.03,
    ssClaimAge: 62,
    events: [{ id: "1", kind: "windfall", year: 2030, amount: 1_000, label: "Gift", taxable: false }, { id: "2", kind: "purchase", year: 2031, amount: 2_000, label: "Car", taxable: false }],
  })
  const parsed = planDocumentSchema.safeParse(out)
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues[0]))
})
