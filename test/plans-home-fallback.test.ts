import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { applyDispose } from "@/lib/plans/plan-dispose"
import { plannedSaleIndex } from "@/lib/plans/plan-home-fallback"
import { summarizePlan } from "@/lib/plans/plan-summary"
import type { HomeFallback, PlanDocument } from "@/lib/plans/plan-types"

const SHORT = 0.5
/** Home sales only happen under stress. */
const STRESS = { homeFallbacks: true }

/** $100k in the bank, $50k a year of spending, no income, a paid-off $500k home; no inflation, no taxes, 2026 start. */
function plan(fallback?: HomeFallback): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 60)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 80 },
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: "Living", amount: 50_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    accounts: [{ ...base.accounts[0], balance: 100_000, returnRate: 0 }],
    assets: [{ id: "h", name: "Home", kind: "home", value: 500_000, appreciation: 0, start: { type: "planStart" }, end: { type: "planEnd" }, costBasis: 100_000, primaryResidence: true, runningCosts: [], ...(fallback ? { fallback } : {}) }],
    debts: [],
  }
}
const shortYear = (doc: PlanDocument) => simulatePlan(doc, STRESS).rows.find((r) => r.shortfall > SHORT)?.year

test("without a backup plan the money runs out and nothing changes", () => {
  const p = simulatePlan(plan(), STRESS)
  assert.equal(p.homeSales, undefined)
  assert.equal(shortYear(plan()), 2028)
  const s = summarizePlan(plan(), p)
  assert.ok(s.equityAtDepletion && Math.abs(s.equityAtDepletion.value - 500_000) < 1, "the whole home is equity")
  assert.ok(Math.abs(s.equityAtDepletion.years - 10) < 0.01, "$500k is ~10 years of $50k spending")
})

test("sell and rent: sold in the year the money would run out, then rent from then on", () => {
  const doc = plan({ then: "rent", monthlyRent: 1_000, price: 0 })
  const p = simulatePlan(doc, STRESS)
  assert.deepEqual(p.homeSales?.map((s) => [s.name, s.year, s.then]), [["Home", 2028, "rent"]])
  const sold = p.rows.find((r) => r.year === 2028)!
  assert.ok(sold.assetSales > 400_000)
  assert.equal(shortYear(doc), 2036, "$500k at $62k a year from 2028 lasts through 2035")
  assert.ok(p.rows.find((r) => r.year === 2030)!.expenses >= 62_000 - 1, "rent added to spending")
  const s = summarizePlan(doc, p)
  assert.deepEqual(s.homeSales, [{ name: "Home", year: 2028, age: 62 }])
})

test("sell and buy smaller: a cash purchase that year, the rest keeps paying the bills", () => {
  const doc = plan({ then: "smaller", monthlyRent: 0, price: 200_000 })
  const p = simulatePlan(doc, STRESS)
  assert.equal(p.homeSales?.length, 1)
  const r = p.rows.find((x) => x.year === 2028)!
  assert.ok(Math.abs(r.assetPurchases - 200_000) < 1)
  assert.ok(Object.keys(r.assetValues).some((id) => id.endsWith("~fallback-home")))
  const later = shortYear(doc)
  assert.ok(later === undefined || later > 2030, "the money lasts longer than without it")
  const s = summarizePlan(doc, p)
  if (s.equityAtDepletion) assert.ok(s.equityAtDepletion.value > 150_000, "the smaller home counts as equity")
})

test("the plan itself never sells: a backup plan only acts in the stress test", () => {
  const doc = plan({ then: "rent", monthlyRent: 1_000, price: 0 })
  const p = simulatePlan(doc)
  assert.equal(p.homeSales, undefined)
  assert.deepEqual(p.rows, simulatePlan(plan()).rows)
})

test("a backup plan that isn't needed never fires", () => {
  const rich = { ...plan({ then: "rent", monthlyRent: 1_000, price: 0 }), accounts: [{ ...plan().accounts[0], balance: 5_000_000 }] }
  const p = simulatePlan(rich, STRESS)
  assert.equal(p.homeSales, undefined)
  assert.deepEqual(p.rows, simulatePlan({ ...rich, assets: rich.assets.map((a) => ({ ...a, fallback: undefined })) }).rows)
})

const downsizeIn = (doc: PlanDocument, year: number) =>
  applyDispose(doc, "h", { mode: "downsize", when: { type: "year", year }, downsize: { to: "rent", price: 0, payWith: "cash", monthlyRent: 1_000 } }, (p) => `${p}-planned`)
const salesYears = (doc: PlanDocument) => simulatePlan(doc, STRESS).rows.filter((r) => r.assetSales > 0).map((r) => r.year)

test("a sale you planned yourself is never sold twice", () => {
  const doc = downsizeIn(plan({ then: "rent", monthlyRent: 1_000, price: 0 }), 2027)
  assert.deepEqual(salesYears(doc), [2027])
  assert.equal(simulatePlan(doc, STRESS).homeSales, undefined, "already sold before the money runs out")
})

test("a home the plan sells later keeps to the plan: running out first doesn't sell it early", () => {
  const doc = downsizeIn(plan({ then: "rent", monthlyRent: 1_000, price: 0 }), 2032)
  const p = simulatePlan(doc, STRESS)
  assert.deepEqual(salesYears(doc), [2032])
  assert.equal(p.homeSales, undefined)
  assert.equal(plannedSaleIndex(doc, doc.assets.find((a) => a.id === "h")!), 6, "2032 is plan year 6")
  assert.equal(plannedSaleIndex(plan(), plan().assets[0]), null, "kept to the plan's end")
})
