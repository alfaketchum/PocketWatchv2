import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import type { PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import { impactOf, impactVariants } from "@/lib/plans/stress/stress-impacts"
import { mixFor } from "@/lib/plans/stress/stress-mix"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const NOW = new Date(2026, 0, 15)

const asset = (id: string, extra: Partial<PlanAsset>): PlanAsset => ({
  id,
  name: id,
  kind: "home",
  value: 500_000,
  appreciation: 0.03,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  runningCosts: [],
  ...extra,
})

/** $1M in stocks, $60k a year of spending, no income. */
function plan(extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 40)
  return {
    ...base,
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: "Living", amount: 60_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    accounts: [{ ...base.accounts[0], balance: 1_000_000 }],
    assets: [],
    debts: [],
    ...extra,
  }
}
const keys = (doc: PlanDocument) => impactVariants(doc).map((v) => v.key)

test("a plain plan only tries spending less", () => {
  assert.deepEqual(keys(plan()), ["spend-less"])
})

test("spend less cuts everyday costs by 10% and leaves one-time and generated ones alone", () => {
  const doc = plan({
    expenses: [
      ...plan().expenses,
      { id: "trip", name: "Trip", category: null, amount: 20_000, growth: null, start: { type: "planStart" }, end: { type: "planStart" }, oneTime: true },
      { id: "tax", name: "Inheritance tax", category: null, amount: 5_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false, origin: "ms-x" },
    ],
  })
  const less = impactVariants(doc).find((v) => v.key === "spend-less")!.doc
  assert.deepEqual(less.expenses.map((e) => Math.round(e.amount)), [54_000, 20_000, 5_000])
  assert.equal(doc.expenses[0].amount, 60_000, "the plan itself is untouched")
})

test("crypto-heavy accounts try half and all of the crypto in stocks and bonds", () => {
  const base = plan()
  const doc = plan({ accounts: [{ ...base.accounts[0], balance: 900_000, source: { kind: "crypto", refId: "c" } }, { ...base.accounts[0], id: "b", balance: 100_000 }] })
  const v = Object.fromEntries(impactVariants(doc).map((x) => [x.key, x.doc]))
  assert.ok(v["crypto-half"] && v["crypto-none"])
  const near = (got: Record<string, number>, want: Record<string, number>) => Object.keys(want).forEach((k) => assert.ok(Math.abs(got[k] - want[k]) < 1e-9, k))
  near({ ...mixFor(v["crypto-half"].accounts[0]) }, { stocks: 0.4, bonds: 0.1, cash: 0, crypto: 0.5 })
  near({ ...mixFor(v["crypto-none"].accounts[0]) }, { stocks: 0.8, bonds: 0.2, cash: 0, crypto: 0 })
  assert.deepEqual(v["crypto-none"].accounts[1], doc.accounts[1], "accounts without crypto are left alone")
})

test("a little crypto isn't worth a row", () => {
  const base = plan()
  const doc = plan({ accounts: [{ ...base.accounts[0], balance: 50_000, source: { kind: "crypto", refId: "c" } }, { ...base.accounts[0], id: "b", balance: 950_000 }] })
  assert.ok(!keys(doc).some((k) => k.startsWith("crypto")))
})

test("the biggest future purchases are each skipped; homes owned now and inherited ones aren't", () => {
  const doc = plan({
    assets: [
      asset("now", { name: "Home" }),
      asset("apt", { name: "Apartment", value: 500_000, start: { type: "year", year: 2040 }, end: { type: "planEnd" }, fallback: { then: "rent", monthlyRent: 2_000, price: 0 } }),
      asset("car", { name: "Car", kind: "vehicle", value: 75_000, start: { type: "year", year: 2035 } }),
      asset("boat", { name: "Boat", kind: "other", value: 20_000, start: { type: "year", year: 2030 } }),
      asset("gift", { name: "Inherited", value: 2_000_000, start: { type: "year", year: 2060 }, acquired: "received" }),
    ],
  })
  const skips = impactVariants(doc).filter((v) => v.key.startsWith("skip-"))
  assert.deepEqual(skips.map((v) => v.label), ["Skip buying Apartment", "Skip buying Car"])
  assert.ok(!skips[0].doc.assets.some((a) => a.id === "apt"))
})

test("homes kept with no backup plan try selling if the money runs out; sold or covered homes don't", () => {
  const doc = plan({
    assets: [
      asset("kept", { name: "Home" }),
      asset("covered", { name: "Cabin", fallback: { then: "rent", monthlyRent: 1_000, price: 0 } }),
      asset("sold", { name: "Condo", end: { type: "year", year: 2035 } }),
    ],
  })
  const sell = impactVariants(doc).find((v) => v.key === "sell-homes")!
  assert.equal(sell.label, "Sell Home if the money runs out")
  assert.deepEqual(sell.doc.assets.find((a) => a.id === "kept")!.fallback, { then: "rent", monthlyRent: 2_000, price: 0 })
  assert.equal(sell.doc.assets.find((a) => a.id === "sold")!.fallback, undefined)
})

test("retiring later is tried only with a paycheck, and moves retirement 3 years", () => {
  assert.ok(!keys(plan()).includes("work-longer"), "no paycheck, nothing to extend")
  const base = plan()
  const paid = plan({ incomes: [{ id: "s", name: "Salary", kind: "salary", amount: 100_000, growth: null, start: { type: "planStart" }, end: { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID }, taxable: true, oneTime: false, contributions: [] }] })
  const v = impactVariants(paid).find((x) => x.key === "work-longer")!
  const before = base.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID)!.timing
  const after = v.doc.milestones.find((m) => m.id === RETIREMENT_MILESTONE_ID)!.timing
  assert.equal(before.type, "age")
  assert.equal(after.type === "age" && before.type === "age" ? after.age - before.age : null, 3)
})

test("an impact is the success rate and the typical run-out age", () => {
  const c = (depletedAge: number | null) => ({ year: 1900, cape: null, avgInflation: null, depletedAge, netWorth: [1], invested: [1] }) as CohortResult
  const r = impactOf("k", "Label", [c(null), c(null), c(70), c(60), c(80)])
  assert.equal(r.successRate, 0.4)
  assert.equal(r.medianRunOutAge, 70)
  assert.equal(impactOf("k", "L", [c(null)]).medianRunOutAge, null)
})
