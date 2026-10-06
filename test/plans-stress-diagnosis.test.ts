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

test("a diversified 401(k) holding nearly everything isn't a risk", () => {
  const doc = plan({ accounts: [account("401(k)", { taxTreatment: "traditional", balance: 900_000 }), account("Roth", { taxTreatment: "roth", balance: 100_000 })] })
  assert.ok(!keys(doc).includes("riskyMix"))
})

const home = (extra: Partial<PlanDocument["assets"][number]> = {}): PlanDocument["assets"][number] => ({
  id: "home",
  name: "Home",
  kind: "home",
  value: 750_000,
  appreciation: 0.03,
  start: { type: "year", year: 2036 },
  end: { type: "planEnd" },
  financing: { mode: "loan", rate: 0.07, downShare: 0.1, termYears: 30 },
  runningCosts: [],
  ...extra,
})

test("big purchase: a financed home names its down payment and how long the payments run", () => {
  const p = find(plan({ assets: [home()] }), "bigPurchase")!
  assert.equal(p.title, "Buying Home at 50 is what drains the accounts")
  assert.match(p.detail, /^\$75k down and \$\d+k a year of payments until 79/)
  assert.equal(p.fix, "skip-home")
})

test("big purchase: payments that outlast the paycheck say by how much", () => {
  const salary = { id: "s", name: "Salary", kind: "salary" as const, amount: 150_000, growth: null, start: { type: "planStart" as const }, end: { type: "year" as const, year: 2051 }, taxable: false, oneTime: false, contributions: [] }
  const p = find(plan({ assets: [home()], incomes: [salary] }), "bigPurchase")!
  assert.match(p.detail, /, 15 years past your last paycheck/)
})

test("housing gap: rent that stops years before a home is bought", () => {
  const doc = plan({ expenses: [expense("Living", 40_000), expense("Rent", 20_000, { category: "Housing", end: { type: "year", year: 2036 } })], assets: [home({ start: { type: "year", year: 2044 }, financing: { mode: "cash", rate: 0, downShare: 1, termYears: 1 } })] })
  const g = find(doc, "housingGap")!
  assert.equal(g.title, "Rent stops at 50, but Home isn't bought until 58")
  assert.equal(g.detail, "8 years with no housing cost. Check when it should stop.")
})

test("no housing gap when the home is bought the year the rent stops", () => {
  const doc = plan({ expenses: [expense("Living", 40_000), expense("Rent", 20_000, { category: "Housing", end: { type: "year", year: 2036 } })], assets: [home({ financing: { mode: "cash", rate: 0, downShare: 1, termYears: 1 } })] })
  assert.ok(!keys(doc).includes("housingGap"))
})

test("failures that had already sold the home are counted", () => {
  const sold = (age: number) => ({ ...trial(age), homeSales: [{ name: "Home", age: age - 5, planned: false }] }) as CohortResult
  const s = find(plan(), "soldStillFailed", [sold(60), sold(61), trial(62), trial(null)])!
  assert.equal(s.title, "67% of the failures had already sold the home")
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

test("back-to-back rents are one stretch of housing, not a gap", () => {
  const doc = plan({
    expenses: [
      expense("Living", 40_000),
      expense("Rent (shared)", 15_000, { category: "Housing", end: { type: "year", year: 2030 } }),
      expense("Rent (1BR)", 25_000, { category: "Housing", start: { type: "year", year: 2030 }, end: { type: "year", year: 2036 } }),
    ],
    assets: [home({ financing: { mode: "cash", rate: 0, downShare: 1, termYears: 1 } })],
  })
  assert.ok(!keys(doc).includes("housingGap"))
})

const job = (id: string, amount: number, start: number | null, end: number | null) => ({
  id,
  name: id,
  kind: "salary" as const,
  amount,
  growth: null,
  start: start === null ? { type: "planStart" as const } : { type: "year" as const, year: start },
  end: end === null ? { type: "planEnd" as const } : { type: "year" as const, year: end },
  taxable: false,
  oneTime: false,
  contributions: [],
})

test("income drop: a layoff to a lower-paid job before the money runs out, with spending that stays", () => {
  const doc = plan({ incomes: [job("Banker", 500_000, null, 2045), job("Corporate", 200_000, 2046, null)] })
  const d = find(doc, "incomeDrop")!
  assert.equal(d.title, "Pay falls from $500k to $200k a year at 59")
  assert.match(d.detail, /^Spending doesn't fall with it: \$40k a year/)
})

test("a short break that pays the same after isn't an income drop", () => {
  const doc = plan({ incomes: [job("Before", 100_000, null, 2030), job("After", 100_000, 2032, null)] })
  assert.ok(!keys(doc).includes("incomeDrop"))
})
