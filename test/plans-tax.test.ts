import test from "node:test"
import assert from "node:assert/strict"
import { bracketTax, federalTax as fedBase, marginalRates, stateTax as stateBase, taxBase, thresholdIndex, type TaxBase, type TaxSituation } from "@/lib/plans/tax/tax-calc"
import { FEDERAL_ORDINARY } from "@/lib/plans/tax/federal-2026"

const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const single: TaxSituation = { status: "single", state: null, index: 1 }
const joint: TaxSituation = { status: "joint", state: null, index: 1 }
/** Ordinary income and long-term gains (the common case). */
const federalTax = (ordinary: number, longGains: number, s: TaxSituation) => fedBase(taxBase({ ordinary, longGains }), s)
const stateTax = (ordinary: number, s: TaxSituation, more: Partial<TaxBase> = {}) => stateBase(taxBase({ ordinary, ...more }), s)

test("federal ordinary brackets (2026, single): $100k wages", () => {
  // Taxable 83,900: 10% of 12,400 + 12% of 38,000 + 22% of 33,500
  close(federalTax(100_000, 0, single), 1_240 + 4_560 + 7_370)
})

test("federal joint: $100k wages is taxed less than single", () => {
  // Taxable 67,800: 10% of 24,800 + 12% of 43,000
  close(federalTax(100_000, 0, joint), 2_480 + 5_160)
})

test("capital gains stack on ordinary income: 0% then 15%", () => {
  // Ordinary 60k single → taxable 43.9k; 5.55k of gains fit under the 49,450 0% line, the rest at 15%.
  const withGains = federalTax(60_000, 20_000, single) - federalTax(60_000, 0, single)
  close(withGains, (20_000 - 5_550) * 0.15)
})

test("retiree living on gains below the 0% threshold pays no federal tax", () => {
  close(federalTax(0, 60_000, single), 0)
})

test("state tax: none, flat and graduated", () => {
  close(stateTax(100_000, { ...single, state: "TX" }), 0)
  close(stateTax(100_000, { ...single, state: "IL" }), (100_000 - 2_850) * 0.0495, 0.01) // $2,850 personal exemption
  // California single: taxable 94,460 through its brackets.
  const ca = stateTax(100_000, { ...single, state: "CA" })
  assert.ok(ca > 5_000 && ca < 7_000, `CA ${ca}`)
})

test("brackets grow with inflation", () => {
  assert.ok(Math.abs(thresholdIndex(2036, 0.03) - Math.pow(1.03, 10)) < 1e-12)
  assert.ok(bracketTax(100_000, FEDERAL_ORDINARY.single, 1.5) < bracketTax(100_000, FEDERAL_ORDINARY.single, 1))
})

test("marginal rates: 22% federal + 4.95% Illinois on the next dollar at $100k", () => {
  const m = marginalRates(taxBase({ ordinary: 100_000 }), { ...single, state: "IL" })
  close(m.ordinary, 0.22 + 0.0495, 1e-9)
})

import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { totalTax } from "@/lib/plans/tax/tax-calc"
import type { PlanAccount, PlanDocument, PlanIncome } from "@/lib/plans/plan-types"

const acct = (id: string, t: PlanAccount["taxTreatment"], balance: number): PlanAccount => ({ id, name: id, taxTreatment: t, balance, costBasis: null, returnRate: 0, owner: null, source: null })
const pay = (amount: number, kind: PlanIncome["kind"] = "salary"): PlanIncome => ({
  id: kind, name: kind, kind, amount, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [],
})

/** Brackets mode, no inflation, starting 2026. */
function plan(patch: Partial<PlanDocument> = {}, settings: Partial<PlanDocument["settings"]> = {}): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return { ...base, settings: { ...base.settings, taxMode: "brackets", inflation: 0, cashBuffer: 0, endAge: 50, ...settings }, accounts: [acct("cash", "cash", 0)], ...patch }
}

test("brackets: $100k salary pays 2026 federal tax, plus state tax where you live", () => {
  close(simulatePlan(plan({ incomes: [pay(100_000)] })).rows[0].incomeTax, 13_170)
  close(simulatePlan(plan({ incomes: [pay(100_000)] }, { state: "IL" })).rows[0].incomeTax, 13_170 + (100_000 - 2_850) * 0.0495)
  close(simulatePlan(plan({ incomes: [pay(100_000)] }, { state: "TX" })).rows[0].incomeTax, 13_170)
})

test("brackets: a retiree's traditional withdrawals are taxed exactly on the year's total", () => {
  const d = plan({
    accounts: [acct("ira", "traditional", 2_000_000)],
    expenses: [{ id: "e", name: "Living", category: null, amount: 60_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  })
  const r = simulatePlan(d).rows[0]
  const withdrawn = r.withdrawalsBy.ira
  const taxes = r.incomeTax + r.withdrawalTax
  close(taxes, totalTax(taxBase({ ordinary: withdrawn }), { status: "single", state: null, index: 1 }), 1)
  // What's left after tax covers the spending (the true-up is funded too).
  close(withdrawn - taxes, 60_000, 5)
  assert.equal(r.shortfall, 0)
})

test("brackets: getting married switches to joint filing from that date", () => {
  const d = plan(
    {
      incomes: [pay(150_000)],
      adjustments: [{ id: "f", kind: "filingStatus", timing: { type: "year", year: 2028 }, status: "joint" }],
    },
  )
  const rows = simulatePlan(d).rows
  assert.ok(rows[2].incomeTax < rows[1].incomeTax - 5_000, `${rows[1].incomeTax} → ${rows[2].incomeTax}`)
})

test("brackets: only 85% of Social Security is taxable", () => {
  const ss = simulatePlan(plan({ incomes: [pay(40_000, "social_security")] })).rows[0].incomeTax
  close(ss, federalTax(34_000, 0, single))
})

test("brackets: selling stocks under the 0% capital-gains line costs no federal tax", () => {
  const brk: PlanAccount = { ...acct("brk", "taxable", 1_000_000), costBasis: 500_000 }
  const d = plan({
    accounts: [brk],
    expenses: [{ id: "e", name: "Living", category: null, amount: 40_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  })
  const r = simulatePlan(d).rows[0]
  close(r.incomeTax + r.withdrawalTax, 0, 1)
})

test("short-term gains are taxed as ordinary income, long-term at 0/15/20%", () => {
  const short = fedBase(taxBase({ ordinary: 100_000, shortGains: 20_000 }), single) - federalTax(100_000, 0, single)
  const long = federalTax(100_000, 20_000, single) - federalTax(100_000, 0, single)
  close(short, 20_000 * 0.22) // taxable 83.9k → 103.9k, all in the 22% bracket
  close(long, 20_000 * 0.15)
})

test("3.8% NIIT on gains above $200k MAGI (single), not on wages", () => {
  close(federalTax(300_000, 0, single) - fedBase(taxBase({ ordinary: 300_000 }), single), 0)
  const withGains = federalTax(150_000, 100_000, single) - federalTax(150_000, 0, single)
  // 100k of gains: 15% federal; NIIT on the 50k above 200k.
  close(withGains, 100_000 * 0.15 + 50_000 * 0.038)
})

test("state gains rules: exclusions, caps, MA short-term, WA gains-only", () => {
  const s = (state: string) => ({ ...single, state })
  // Wisconsin excludes 30% of long-term gains; short-term gains are fully taxed.
  assert.ok(stateTax(50_000, s("WI"), { longGains: 100_000 }) < stateTax(50_000, s("WI"), { shortGains: 100_000 }))
  close(stateTax(50_000, s("WI"), { longGains: 100_000 }), stateTax(120_000, s("WI")))
  // Arkansas: half of long-term gains.
  close(stateTax(0, s("AR"), { longGains: 100_000 }), stateTax(50_000, s("AR")))
  // Massachusetts: short-term at 8.5%, long-term at 5%.
  close(stateTax(100_000, s("MA"), { shortGains: 10_000 }) - stateTax(100_000, s("MA")), 850)
  close(stateTax(100_000, s("MA"), { longGains: 10_000 }) - stateTax(100_000, s("MA")), 500)
  // Hawaii caps long-term gains at 7.25%.
  close(stateTax(500_000, s("HI"), { longGains: 100_000 }) - stateTax(500_000, s("HI")), 7_250)
  // Montana: long-term gains at 4.1% above its threshold, not 5.65%.
  close(stateTax(200_000, s("MT"), { longGains: 10_000 }) - stateTax(200_000, s("MT")), 410)
  // Washington: no income tax; 7% on long-term gains over $278k, real estate exempt.
  close(stateTax(500_000, s("WA")), 0)
  close(stateTax(0, s("WA"), { longGains: 378_000 }), 7_000)
  close(stateTax(0, s("WA"), { longGains: 378_000, realEstateGains: 378_000 }), 0)
  close(stateTax(0, s("WA"), { shortGains: 378_000 }), 0)
})

test("brackets: a trading account's short-term gains are taxed as income", () => {
  const brk = (shortTermShare: number): PlanAccount => ({ ...acct("brk", "taxable", 1_000_000), costBasis: 0, shortTermShare })
  const living = { id: "e", name: "Living", category: null, amount: 100_000, growth: 0, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, oneTime: false }
  const taxes = (share: number) => {
    const r = simulatePlan(plan({ accounts: [brk(share)], expenses: [living] })).rows[0]
    return r.incomeTax + r.withdrawalTax
  }
  assert.ok(taxes(1) > taxes(0) + 5_000, `${taxes(0)} → ${taxes(1)}`)
})

test("brackets: moving to another state changes state tax from then on", () => {
  const d = plan(
    { incomes: [pay(150_000)], adjustments: [{ id: "m", kind: "state", timing: { type: "year", year: 2028 }, state: "TX" }] },
    { state: "CA" },
  )
  const rows = simulatePlan(d).rows
  close(rows[0].incomeTax - rows[2].incomeTax, stateTax(150_000, { ...single, state: "CA" }), 1)
})
