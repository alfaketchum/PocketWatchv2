import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { fallbackHomes, plannedSaleIndex } from "@/lib/plans/plan-home-fallback"
import type { HomeFallback, PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import { bucketOf, outcomeBuckets } from "@/lib/plans/stress/stress-outcomes"
import { runCohort, summarize } from "@/lib/plans/stress/stress-test"

const NOW = new Date(2026, 0, 15)

const home = (fallback?: HomeFallback, extra: Partial<PlanAsset> = {}): PlanAsset => ({
  id: "h",
  name: "Home",
  kind: "home",
  value: 500_000,
  appreciation: 0,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  costBasis: 100_000,
  primaryResidence: true,
  runningCosts: [],
  ...(fallback ? { fallback } : {}),
  ...extra,
})

/** Age 60–79: $100k in one stock account, $50k a year of spending, no income, a paid-off $500k home; no taxes or inflation. */
function plan(fallback?: HomeFallback, homeValue = 500_000): PlanDocument {
  const base = blankPlanDocument(NOW, 60)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 80 },
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: "Living", amount: 50_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    accounts: [{ ...base.accounts[0], balance: 100_000, returnRate: 0, mix: { stocks: 1, bonds: 0, cash: 0, crypto: 0 } }],
    assets: [home(fallback, { value: homeValue })],
    debts: [],
  }
}

/** Flat markets (no real return) for long enough to cover the plan from any start. */
function flatHistory(years = 40): AnnualHistory {
  const zeros = Array.from({ length: years }, () => 0)
  return { years: zeros.map((_, i) => 1900 + i), stocks: zeros, bonds: zeros, cape: zeros.map(() => 20), inflation: zeros.map(() => null), stockLogMean: 0, latestCape: 20 }
}

const RENT: HomeFallback = { then: "rent", monthlyRent: 1_000, price: 0 }
const SMALLER: HomeFallback = { then: "smaller", monthlyRent: 0, price: 200_000 }
const yard = { startValue: 600_000, yearlySpending: 50_000, endAge: 80, measure: "invested" as const }

test("kept: a trial runs out of money with the home untouched", () => {
  const c = runCohort(plan(), flatHistory(), 0, 0)
  assert.equal(c.soldHome, false)
  assert.equal(c.depletedAge, 62, "$100k at $50k a year runs dry in the third year")
  assert.ok(Math.abs((c.equityAtDepletion ?? 0) - 500_000) < 1, "the whole home is still there")
  assert.equal(bucketOf(c, yard), "catastrophic")
})

test("sell and rent: the trial sells the home, lasts longer, and counts as sold", () => {
  const kept = runCohort(plan(), flatHistory(), 0, 0)
  const sold = runCohort(plan(RENT), flatHistory(), 0, 0)
  assert.equal(sold.soldHome, true)
  assert.ok(sold.depletedAge === null || sold.depletedAge > kept.depletedAge!, "the sale keeps the money going")
  assert.ok(sold.invested[2] > 300_000, "the sale proceeds land in the accounts the year it sells")
})

test("sell and buy smaller: the smaller home stays in net worth", () => {
  const c = runCohort(plan(SMALLER), flatHistory(), 0, 0)
  assert.equal(c.soldHome, true)
  assert.ok(c.netWorth[3] - c.invested[3] >= 200_000 - 1, "the smaller home bought with cash is still owned")
})

test("summary: with a home big enough to cover the rest, the sale turns every failure into a success", () => {
  const history = flatHistory()
  const starts = [0, 5, 10, 15]
  const run = (doc: PlanDocument) => starts.map((s) => runCohort(doc, history, s, 0))
  // $1.5M of proceeds at $62k a year (living + rent) lasts 24 years, past the plan's 18 after the sale.
  const kept = summarize(run(plan(undefined, 1_500_000)), null)
  const sold = summarize(run(plan(RENT, 1_500_000)), null)
  assert.equal(kept.successRate, 0)
  assert.equal(sold.successRate, 1)
  assert.ok(sold.cohorts.every((c) => c.soldHome))
  assert.ok(sold.cohorts.filter((c) => c.depletedAge === null).every((c) => bucketOf(c, yard) === "soldHome"))
})

test("a trial that never runs short never sells, even with the setting on", () => {
  const rich = { ...plan(RENT), accounts: [{ ...plan().accounts[0], balance: 5_000_000 }] }
  const c = runCohort(rich, flatHistory(), 0, 0)
  assert.equal(c.soldHome, false)
  assert.equal(c.depletedAge, null)
})

test("the setting lists the plan's own homes only", () => {
  const doc = plan()
  const withOthers: PlanDocument = {
    ...doc,
    assets: [
      ...doc.assets,
      home(undefined, { id: "h2", name: "Cabin" }),
      home(undefined, { id: "h3", name: "Next home", replacementOf: "h2" }),
      { ...home(), id: "car", name: "Car", kind: "vehicle" },
    ],
  }
  assert.deepEqual(fallbackHomes(withOthers).map((a) => a.id), ["h", "h2"])
})

/** The plan with its home sold in 2035 (plan year 9, age 69). */
function sellsIn2035(): PlanDocument {
  const doc = plan()
  return { ...doc, assets: doc.assets.map((a) => ({ ...a, end: { type: "year" as const, year: 2035 } })) }
}

test("a home the plan sells later is sold sooner in a trial where the money runs out first", () => {
  const c = runCohort(sellsIn2035(), flatHistory(), 0, 0)
  assert.deepEqual(c.homeSales, [{ name: "Home", age: 62, planned: true, plannedAge: 69 }])
  assert.ok(c.depletedAge === null || c.depletedAge > 62, "the early sale keeps the money going past 62")
})

test("a trial that never runs short keeps the plan's sale year", () => {
  const doc = sellsIn2035()
  const rich = { ...doc, accounts: [{ ...doc.accounts[0], balance: 5_000_000 }] }
  assert.deepEqual(runCohort(rich, flatHistory(), 0, 0).homeSales, [{ name: "Home", age: 69, planned: true }])
})

test("a kept home is out of cash on net worth, catastrophic on money in accounts", () => {
  // A $1.5M home outlasts the unpaid bills ($50k a year from 62 to 80), so net worth never runs out.
  const c = runCohort(plan(undefined, 1_500_000), flatHistory(), 0, 0)
  assert.equal(c.brokeAge, undefined)
  assert.equal(bucketOf(c, yard), "catastrophic")
  assert.equal(bucketOf(c, { ...yard, measure: "netWorth" }), "outOfCash")
})

test("a smaller kept home is eaten by the unpaid bills: catastrophic on net worth too", () => {
  const c = runCohort(plan(), flatHistory(), 0, 0)
  assert.ok(c.brokeAge !== undefined)
  assert.equal(bucketOf(c, { ...yard, measure: "netWorth" }), "catastrophic")
})

test("each trial lists its home sales: the stress test's own, with the age", () => {
  const sold = runCohort(plan(RENT), flatHistory(), 0, 0)
  assert.deepEqual(sold.homeSales, [{ name: "Home", age: 62, planned: false }])
  assert.equal(runCohort(plan(), flatHistory(), 0, 0).homeSales, undefined, "a kept home is never listed")
})

test("running out after a sale, early or by the backup plan, says so on the outcome", () => {
  const early = runCohort(sellsIn2035(), flatHistory(), 0, 0)
  const backup = runCohort(plan(RENT), flatHistory(), 0, 0)
  assert.ok(early.depletedAge !== null && backup.depletedAge !== null, "$500k doesn't last to 80 either way")
  const by = Object.fromEntries(outcomeBuckets([early, backup], yard).map((b) => [b.key, b]))
  assert.equal(by.catastrophic.count, 2)
  assert.equal(by.catastrophic.salesNote, "2 ran out after selling a home")
})
