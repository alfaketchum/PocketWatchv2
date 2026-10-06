import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import type { PlanAccount, PlanDocument, PlanIncome } from "@/lib/plans/plan-types"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import { retirementAge, socialSecurityOf } from "@/lib/plans/stress/stress-levers"
import type { SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import { applyChange, solve, solverApplies, type SolverKey } from "@/lib/plans/stress/stress-solvers"

const NOW = new Date(2026, 0, 15)
const HISTORY: SamplingOptions = { method: "history", trials: 0, blockLength: 1, seed: 1 }

/** Every year the same: stocks and bonds earn these real returns, no inflation, CAPE 20. */
function history(stocks: number, bonds = 0, years = 40): AnnualHistory {
  const at = (v: number) => Array.from({ length: years }, () => v)
  return { years: at(0).map((_, i) => 1900 + i), stocks: at(stocks), bonds: at(bonds), cape: at(20), inflation: at(0).map(() => null), stockLogMean: Math.log(1 + stocks), latestCape: 20 }
}

const account = (extra: Partial<PlanAccount> = {}): PlanAccount => ({
  id: "a",
  name: "Brokerage",
  taxTreatment: "taxable",
  balance: 1_000_000,
  costBasis: 1_000_000,
  returnRate: 0,
  owner: null,
  source: null,
  mix: { stocks: 0.8, bonds: 0.2, cash: 0, crypto: 0 },
  ...extra,
})

/** Age 60 to 80 (20 years), $1M invested, `spend` a year of everyday spending, no income, taxes or inflation. */
function plan(spend: number, extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 60)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 80 },
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: "Living", amount: spend, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    accounts: [account()],
    assets: [],
    debts: [],
    ...extra,
  }
}

const run = (key: SolverKey, doc: PlanDocument, annual = history(0), target = 0.9) => solve({ key, doc, annual, anchor: 0, inflation: "plan", sampling: HISTORY, target })!

test("max safe spending: with flat markets, $1M over 20 years is about $50k a year", () => {
  const r = run("spending", plan(80_000))
  assert.equal(r.status, "found")
  assert.equal(r.baselineRate, 0)
  assert.equal(r.successRate, 1)
  assert.ok(r.change.kind === "spending" && r.change.factor >= 0.62 && r.change.factor <= 0.66, `factor ${JSON.stringify(r.change)}`)
  assert.ok(typeof r.value === "number" && r.value >= 49_000 && r.value <= 53_000)
  assert.equal(r.now, 80_000)
})

test("max safe spending: a plan that already lasts says how much more it could spend", () => {
  const r = run("spending", plan(30_000))
  assert.equal(r.status, "alreadyMet")
  assert.ok(r.change.kind === "spending" && r.change.factor >= 1.6 && r.change.factor <= 1.75)
})

test("max safe spending: even 30% of the spending can fall short", () => {
  const r = run("spending", plan(500_000))
  assert.equal(r.status, "unreachable")
  assert.deepEqual(r.change, { kind: "spending", factor: 0.3 })
  assert.equal(r.successRate, 0)
})

test("investment mix: the first rung that reaches the target, from the least change", () => {
  // Crypto assumed to earn nothing, stocks 5% real: half crypto still runs short, all stocks lasts.
  const doc = plan(70_000, { accounts: [account({ mix: { stocks: 0, bonds: 0, cash: 0, crypto: 1 } })] })
  const r = run("mix", doc, history(0.05))
  assert.equal(r.baselineRate, 0)
  assert.equal(r.status, "found")
  assert.equal(r.value, "All stocks")
  assert.equal(r.successRate, 1)
  assert.ok(applyChange(doc, r.change).accounts.every((a) => a.mix?.stocks === 1))
})

test("investment mix: when no rung reaches it, the best one", () => {
  const doc = plan(200_000, { accounts: [account({ mix: { stocks: 0, bonds: 0, cash: 0, crypto: 1 } })] })
  const r = run("mix", doc, history(0.05))
  assert.equal(r.status, "unreachable")
})

const salary = (amount: number): PlanIncome => ({
  id: "s",
  name: "Salary",
  kind: "salary",
  amount,
  growth: null,
  start: { type: "planStart" },
  end: { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID },
  taxable: false,
  oneTime: false,
  contributions: [],
})

test("earliest safe retirement: works until savings cover the rest", () => {
  // $100k pay, $60k spending, nothing saved: each working year adds $40k, each retired year costs $60k.
  const doc = plan(60_000, { incomes: [salary(100_000)], accounts: [account({ balance: 0, costBasis: 0 })] })
  assert.ok(solverApplies(doc, "retirement"))
  const r = run("retirement", doc)
  assert.equal(r.status, "found")
  assert.ok(typeof r.value === "number" && r.value >= 71 && r.value <= 73, `age ${r.value}`)
  assert.equal(retirementAge(applyChange(doc, r.change)), r.value)
})

test("earliest safe retirement: a plan that already lasts may retire sooner", () => {
  const doc = plan(30_000, { incomes: [salary(100_000)] })
  const r = run("retirement", doc)
  assert.equal(r.status, "alreadyMet")
  assert.ok(typeof r.value === "number" && r.value <= (r.now as number))
})

test("solvers that have nothing to move don't run", () => {
  assert.equal(solverApplies(plan(50_000), "retirement"), false, "no paycheck")
  assert.equal(solverApplies(plan(50_000), "socialSecurity"), false, "no Social Security")
  assert.equal(solve({ key: "retirement", doc: plan(50_000), annual: history(0), anchor: 0, inflation: "plan", sampling: HISTORY, target: 0.9 }), null)
})

test("Social Security: tries every claim age and keeps the best", () => {
  const base = plan(65_000)
  const person = base.people[0]
  const ss: PlanIncome = {
    id: "ss",
    name: "Social Security",
    kind: "social_security",
    amount: 0,
    growth: null,
    start: { type: "age", personId: person.id, age: 62 },
    end: { type: "planEnd" },
    taxable: false,
    oneTime: false,
    contributions: [],
    socialSecurity: { pia: 1_000, claimAge: 62 },
  }
  const doc = { ...base, incomes: [ss] }
  const r = run("socialSecurity", doc)
  assert.ok(typeof r.value === "number" && r.value >= 62 && r.value <= 70)
  assert.ok(r.successRate >= r.baselineRate)
  assert.equal(socialSecurityOf(applyChange(doc, r.change))!.claimAge, r.value)
})
