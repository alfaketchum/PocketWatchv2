import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import type { PlanAccount, PlanDocument, PlanExpense } from "@/lib/plans/plan-types"
import { diagnose, type InsightKey } from "@/lib/plans/stress/stress-diagnosis"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const NOW = new Date(2026, 0, 15)

const account = (id: string, extra: Partial<PlanAccount>): PlanAccount => ({
  id,
  name: id,
  taxTreatment: "taxable",
  balance: 1_000_000,
  costBasis: 1_000_000,
  returnRate: 0.06,
  owner: null,
  source: null,
  ...extra,
})
const expense = (id: string, amount: number, extra: Partial<PlanExpense> = {}): PlanExpense => ({
  id,
  name: id,
  category: "Living",
  amount,
  growth: null,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  oneTime: false,
  ...extra,
})

/** Age 40 to 90, $1M in one 80/20 account, $40k a year of spending, no income, no inflation or taxes. */
function plan(extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 90 },
    incomes: [],
    expenses: [expense("Living", 40_000)],
    accounts: [account("Brokerage", {})],
    assets: [],
    debts: [],
    ...extra,
  }
}

const trial = (depletedAge: number | null, equityAtDepletion = 0) => ({ year: 1900, cape: null, avgInflation: null, depletedAge, equityAtDepletion, netWorth: [0], invested: [0] }) as CohortResult
/** Half the trials run out, at 60 to 64. */
const halfFail = (equity = 0) => [...[60, 61, 62, 63, 64].map((a) => trial(a, equity)), ...Array.from({ length: 5 }, () => trial(null))]
const insights = (doc: PlanDocument, cohorts = halfFail()) => diagnose(doc, simulatePlan(doc), cohorts, null)
const keys = (doc: PlanDocument, cohorts?: CohortResult[]) => insights(doc, cohorts).map((i) => i.key)
const find = (doc: PlanDocument, key: InsightKey, cohorts?: CohortResult[]) => insights(doc, cohorts).find((i) => i.key === key)

test("nothing ran out: nothing to explain", () => {
  assert.deepEqual(insights(plan(), [trial(null), trial(null)]), [])
})

test("when: the share that runs out and the typical age, first", () => {
  const w = insights(plan())[0]
  assert.equal(w.key, "when")
  assert.equal(w.title, "50% of trials run out, typically at 62")
  assert.equal(w.detail, "Most between 60 and 64.")
})

test("a crypto-heavy plan with no paycheck says both, and points the mix at its solver", () => {
  const doc = plan({ accounts: [account("Crypto", { balance: 900_000, source: { kind: "crypto", refId: "c" } }), account("Brokerage", { balance: 100_000 })] })
  const k = keys(doc)
  assert.ok(k.includes("riskyMix") && k.includes("noPaycheck"))
  assert.equal(find(doc, "riskyMix")!.title, "90% of your investments are crypto")
  assert.equal(find(doc, "riskyMix")!.fix, "mix")
})

test("a paycheck through the crunch years means no 'no paycheck'", () => {
  const doc = plan({ incomes: [{ id: "s", name: "Salary", kind: "salary", amount: 50_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }] })
  assert.ok(!keys(doc).includes("noPaycheck"))
})

test("one account holding nearly everything is called out", () => {
  const doc = plan({ accounts: [account("Big", { balance: 900_000 }), account("Small", { balance: 100_000 })] })
  assert.equal(find(doc, "riskyMix")!.title, "90% of your investments are in Big")
})

test("mostly bonds over a long plan is too timid", () => {
  const doc = plan({ accounts: [account("Bonds", { mix: { stocks: 0.2, bonds: 0.8, cash: 0, crypto: 0 } })] })
  assert.equal(find(doc, "lowRisk")!.fix, "mix")
})

test("crunch: spending at the run-out age vs today, naming what grew", () => {
  const doc = plan({ expenses: [expense("Living", 40_000), expense("College", 50_000, { start: { type: "year", year: 2047 } })] })
  const c = find(doc, "crunch")!
  assert.equal(c.title, "Spending climbs to $90k a year by 62 (now $40k)")
  assert.match(c.detail, /^College \+\$50k/)
  assert.equal(c.fix, "spending")
})

test("late money: an inheritance after the typical run-out age, with its age and amount", () => {
  const doc = plan({ deposits: [{ id: "d", name: "Inheritance", accountId: "Brokerage", amount: 500_000, timing: { type: "year", year: 2056 } }] })
  const l = find(doc, "lateMoney")!
  assert.equal(l.title, "Money that arrives after 62 can't help")
  assert.match(l.detail, /Inheritance \(\$500k\) at 70/)
})

test("an inheritance before the failures isn't late", () => {
  const doc = plan({ deposits: [{ id: "d", name: "Inheritance", accountId: "Brokerage", amount: 500_000, timing: { type: "year", year: 2030 } }] })
  assert.ok(!keys(doc).includes("lateMoney"))
})

test("illiquid: failed trials that still owned a lot of property", () => {
  assert.equal(find(plan(), "illiquid", halfFail(800_000))!.title, "Typically $800k of property left when the money runs out")
  assert.ok(!keys(plan(), halfFail(0)).includes("illiquid"))
})

test("optimism: the steady plan never runs out but trials do", () => {
  const o = find(plan(), "optimism")!
  assert.match(o.detail, /^It assumes 6% a year after inflation/)
})
