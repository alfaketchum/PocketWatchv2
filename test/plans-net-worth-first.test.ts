import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { summarizePlan } from "@/lib/plans/plan-summary"
import type { PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import { solve } from "@/lib/plans/stress/stress-solvers"
import { isBroke, runCohort, summarize, type CohortResult } from "@/lib/plans/stress/stress-test"

const NOW = new Date(2026, 0, 15)

const home = (value: number): PlanAsset => ({
  id: "h",
  name: "Home",
  kind: "home",
  value,
  appreciation: 0,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  acquired: "received",
  primaryResidence: true,
  runningCosts: [],
  fallback: { then: "keep", monthlyRent: 0, price: 0 },
})

/** Age 60 to 80: $100k in the accounts, $50k a year of spending, no income, a paid-off home; no taxes or inflation. */
function plan(homeValue: number): PlanDocument {
  const base = blankPlanDocument(NOW, 60)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 80 },
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: "Living", amount: 50_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    accounts: [{ ...base.accounts[0], taxTreatment: "taxable", balance: 100_000, returnRate: 0, mix: { stocks: 1, bonds: 0, cash: 0, crypto: 0 } }],
    assets: homeValue > 0 ? [home(homeValue)] : [],
    debts: [],
  }
}

function flat(years = 40): AnnualHistory {
  const zeros = Array.from({ length: years }, () => 0)
  return { years: zeros.map((_, i) => 1900 + i), stocks: zeros, bonds: zeros, cape: zeros.map(() => 20), inflation: zeros.map(() => null), stockLogMean: 0, latestCape: 20 }
}

test("running out of cash with enough home left isn't broke; running out with nothing is", () => {
  const withHome = runCohort(plan(2_000_000), flat(), 0, 0)
  const without = runCohort(plan(0), flat(), 0, 0)
  assert.equal(withHome.depletedAge, 62)
  assert.equal(isBroke(withHome), false, "$2M of home outlasts 18 years of $50k unpaid bills")
  assert.equal(isBroke(without), true)
  assert.equal(without.brokeAge, 62)
})

test("unpaid bills pile up as debt: a smaller home is eaten by them and the plan goes broke later", () => {
  const p = simulatePlan(plan(500_000))
  const at = (age: number) => p.rows[age - 60]
  assert.ok(Math.abs((at(64).debtBalances["~unpaid-bills"] ?? 0) - 150_000) < 1_000, "three years of $50k bills unpaid by 64")
  assert.ok(at(64).netWorth < at(62).netWorth, "net worth falls as the bills go unpaid")
  const c = runCohort(plan(500_000), flat(), 0, 0)
  assert.ok(c.brokeAge !== undefined && c.brokeAge > 62 && c.brokeAge <= 72, `broke at ${c.brokeAge}`)
})

test("a plan that starts in debt isn't broke until its cash runs out", () => {
  const c = { depletedAge: null, lowestWorthAfterRunOut: undefined, netWorth: [-50_000, -20_000] } as unknown as CohortResult
  assert.equal(isBroke(c), false)
})

test("the summary has both rates: cash lasts and net worth lasts", () => {
  const s = summarize([runCohort(plan(2_000_000), flat(), 0, 0), runCohort(plan(0), flat(), 0, 0)], null)
  assert.equal(s.successRate, 0, "both run out of cash")
  assert.equal(s.netWorthRate, 0.5, "only the one without a home goes broke")
})

test("the plan summary says when it goes broke, and splits net worth into accounts and property", () => {
  const withHome = summarizePlan(plan(2_000_000), simulatePlan(plan(2_000_000)))
  assert.equal(withHome.depletedAge, 62)
  assert.equal(withHome.brokeAge, null)
  assert.ok(Math.abs(withHome.endingSplit.property - 2_000_000) < 1)
  assert.ok(withHome.endingSplit.accounts < -800_000, "the unpaid bills come off the accounts side")
  const without = summarizePlan(plan(0), simulatePlan(plan(0)))
  assert.equal(without.brokeAge, 62)
})

test("solving for net worth reaches a target that cash can't", () => {
  const req = { key: "spending" as const, doc: plan(2_000_000), annual: flat(), anchor: 0, inflation: "plan" as const, sampling: { method: "history" as const, trials: 0, blockLength: 1, seed: 1 }, target: 0.9 }
  const cash = solve(req)!
  const worth = solve({ ...req, goal: "netWorth" })!
  assert.equal(cash.baselineRate, 0)
  assert.equal(worth.baselineRate, 1, "the $2M home keeps net worth lasting")
  assert.equal(worth.status, "alreadyMet")
})
