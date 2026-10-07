import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { newChild } from "@/lib/plans/plan-children"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { keyYears } from "@/lib/plans/stress/stress-key-years"

const NOW = new Date(2026, 0, 15)

/** Age 40 to 90, $500k in one account, $40k a year of spending, a $100k salary until 2040; no inflation or taxes. */
function plan(extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 90 },
    incomes: [{ id: "s", name: "Salary", kind: "salary", amount: 100_000, growth: null, start: { type: "planStart" }, end: { type: "year", year: 2040 }, taxable: false, oneTime: false, contributions: [] }],
    expenses: [{ id: "e", name: "Living", category: "Living", amount: 40_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    accounts: [{ ...base.accounts[0], taxTreatment: "taxable", balance: 500_000, returnRate: 0 }],
    assets: [],
    debts: [],
    ...extra,
  }
}
const years = (doc: PlanDocument, runOut: number | null = null) => keyYears(doc, simulatePlan(doc), runOut)
const at = (doc: PlanDocument, age: number, runOut: number | null = null) => years(doc, runOut).find((y) => y.age === age)
const texts = (doc: PlanDocument, age: number, runOut: number | null = null) => at(doc, age, runOut)?.events.map((e) => e.text) ?? []

test("today and the plan's end are always there, with pay, what goes out and the accounts", () => {
  const ys = years(plan())
  assert.equal(ys[0].age, 40)
  assert.deepEqual(ys[0].events.map((e) => e.text), ["Today"])
  assert.equal(ys[0].pay, 100_000)
  assert.equal(ys[0].out, 40_000)
  assert.equal(ys.at(-1)!.events.at(-1)!.text, "Plan ends")
})

test("a job that ends on a date, retirement and the money running out each get a row", () => {
  assert.ok(texts(plan(), 54).includes("Salary ends"))
  const short = years(plan()).find((y) => y.events.some((e) => e.tone === "warn"))!
  assert.equal(short.events.find((e) => e.tone === "warn")!.text, "Cash runs out (steady returns)")
  assert.ok(short.accounts < 1)
  assert.ok(years(plan()).some((y) => y.events.some((e) => e.tone === "bad" && e.text === "Broke: nothing left to sell (steady returns)")), "nothing else is owned, so net worth hits $0 too")
})

test("a purchase shows its down payment; a child is born; an inheritance arrives", () => {
  const doc = plan({
    assets: [{ id: "h", name: "House", kind: "home", value: 400_000, appreciation: 0, start: { type: "year", year: 2030 }, end: { type: "planEnd" }, financing: { mode: "loan", rate: 0.06, downShare: 0.25, termYears: 30 }, runningCosts: [] }],
    children: [newChild("kid", "Lily", 2032)],
    deposits: [{ id: "d", name: "Inheritance", accountId: "acct-cash", amount: 250_000, timing: { type: "year", year: 2045 } }],
  })
  assert.deepEqual(texts(doc, 44), ["Buys House: $100k down"])
  assert.ok(texts(doc, 46).includes("Lily born"))
  assert.ok(texts(doc, 59).includes("Inheritance: +$250k"))
})

test("the stress test's typical run-out age gets its own marker", () => {
  const e = at(plan(), 70, 70)!.events
  assert.ok(e.some((x) => x.text === "Typical stress trial's cash runs out" && x.tone === "warn"))
})

test("pay tied to a milestone isn't listed twice (the milestone names it)", () => {
  const doc = plan()
  const retire = doc.milestones.find((m) => m.kind === "retirement")!
  const tied = { ...doc, incomes: [{ ...doc.incomes[0], end: { type: "milestone" as const, milestoneId: retire.id } }] }
  const row = years(tied).find((y) => y.events.some((e) => e.text === retire.name))!
  assert.ok(!row.events.some((e) => e.text === "Salary ends"))
})

test("too many years: the money running out is never cut", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, name: `Gift ${i}`, kind: "other" as const, amount: 1_000, growth: null, start: { type: "year" as const, year: 2027 + i }, end: { type: "year" as const, year: 2027 + i }, taxable: false, oneTime: true, contributions: [] }))
  const doc = plan({ incomes: [...plan().incomes, ...many] })
  const ys = years(doc)
  assert.ok(ys.length <= 14)
  assert.ok(ys.some((y) => y.events.some((e) => e.tone === "warn")))
  assert.equal(ys.at(-1)!.events.at(-1)!.text, "Plan ends")
})
