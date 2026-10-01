import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import { parsePlanDocument } from "@/lib/plans/plan-schema"
import type { PlanAccount, PlanDocument } from "@/lib/plans/plan-types"
import { annualHistory, type AnnualHistory } from "@/lib/plans/stress/stress-history"
import { defaultMix, yearReturn } from "@/lib/plans/stress/stress-mix"
import { anchorIndex, cohortStarts, percentile, runCohort, summarize } from "@/lib/plans/stress/stress-test"
import type { MarketHistory } from "@/lib/fire/fire-types"

const NOW = new Date(2026, 0, 15)

function account(id: string, extra: Partial<PlanAccount> = {}): PlanAccount {
  return { id, name: id, taxTreatment: "taxable", balance: 100_000, costBasis: null, returnRate: 0.05, owner: null, source: null, ...extra }
}

/** A 10-year plan (age 35–44) spending `spend` a year from one stock account, no taxes or inflation. */
function plan(spend: number, extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 45 },
    accounts: [account("a", { mix: { stocks: 1, bonds: 0, cash: 0, crypto: 0 } })],
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: null, amount: spend, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    ...extra,
  }
}

function history(stocks: number[], cape: (number | null)[] = stocks.map(() => 20)): AnnualHistory {
  return { years: stocks.map((_, i) => 1900 + i), stocks, bonds: stocks.map(() => 0), cape, stockLogMean: Math.log(1.05), latestCape: 40 }
}

test("the returnFor hook is inert when it returns each account's own rate", () => {
  const doc = plan(5_000)
  assert.deepEqual(simulatePlan(doc, { returnFor: (a) => a.returnRate }), simulatePlan(doc))
})

test("annualHistory compounds complete calendar years only", () => {
  const months = [...Array.from({ length: 12 }, (_, m) => `1900-${String(m + 1).padStart(2, "0")}`), "1901-01", "1901-02"]
  const h: MarketHistory = {
    months,
    equity: new Float64Array(months.map(() => 0.01)),
    bonds: new Float64Array(months.map(() => 0)),
    cape: months.map((_, i) => (i === 0 ? 15 : null)),
    dataThrough: "1901-02",
    latestCape: 30,
    latestCapeMonth: "1901-02",
  }
  const a = annualHistory(h)
  assert.deepEqual(a.years, [1900])
  assert.ok(Math.abs(a.stocks[0] - (Math.pow(1.01, 12) - 1)) < 1e-12)
  assert.equal(a.cape[0], 15)
})

test("yearReturn: cash earns inflation; crypto swings twice as hard around its own return, floored", () => {
  const market = { stockReal: -0.2, bondReal: 0.01, stockLogMean: Math.log(1.06) }
  const cash = account("c", { taxTreatment: "cash" })
  assert.deepEqual(defaultMix(cash), { stocks: 0, bonds: 0, cash: 1, crypto: 0 })
  assert.ok(Math.abs(yearReturn(cash, market, 0.03) - 0.03) < 1e-12)
  const crypto = account("x", { source: { kind: "crypto", refId: "w" }, returnRate: 0.1 })
  // 10% assumed (0% inflation) × (0.8 / 1.06)² − 1 ≈ −37.3%
  assert.ok(Math.abs(yearReturn(crypto, market, 0) - (1.1 * Math.pow(0.8 / 1.06, 2) - 1)) < 1e-12)
  assert.equal(yearReturn(crypto, { ...market, stockReal: -0.8 }, 0), -0.9)
  // An average stock year leaves crypto at its own assumed return.
  assert.ok(Math.abs(yearReturn(crypto, { ...market, stockReal: 0.06 }, 0) - 0.1) < 1e-12)
})

test("a crash in year one sinks a thin plan that a flat market carries", () => {
  const doc = plan(9_000)
  const flat = history(Array(12).fill(0))
  const crash = history([-0.5, ...Array(11).fill(0)])
  assert.equal(runCohort(doc, flat, 0, 0).depletedAge, null)
  assert.ok(runCohort(doc, crash, 0, 0).depletedAge !== null)
})

test("cohorts must cover the plan from the anchor to its end; retirement anchoring needs fewer years", () => {
  const doc: PlanDocument = {
    ...plan(1_000),
    milestones: blankPlanDocument(NOW, 35).milestones.map((m) =>
      m.id === RETIREMENT_MILESTONE_ID ? { ...m, timing: { type: "age", personId: blankPlanDocument(NOW, 35).people[0].id, age: 40 } } : m,
    ),
  }
  const h = history(Array(12).fill(0.05))
  assert.equal(anchorIndex(doc, "start"), 0)
  assert.equal(anchorIndex(doc, "retirement"), 5)
  assert.equal(cohortStarts(doc, h, 0).length, 3, "10 plan years in 12 history years")
  assert.equal(cohortStarts(doc, h, 5).length, 8, "only the 5 retirement years need history")
})

test("summarize: CAPE filter, success rate and percentiles", () => {
  const doc = plan(9_000)
  const h = history([-0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [35, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10])
  const all = cohortStarts(doc, h, 0).map((s) => runCohort(doc, h, s, 0))
  assert.equal(all.length, 3)
  assert.ok(Math.abs(summarize(all, null).successRate - 2 / 3) < 1e-12)
  const pricey = summarize(all, 30)
  assert.equal(pricey.cohorts.length, 1)
  assert.equal(pricey.successRate, 0)
  assert.equal(pricey.worst?.year, 1900)
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5)
})

test("account mixes are saved normalized", () => {
  const base = blankPlanDocument(NOW)
  const parsed = parsePlanDocument({ ...base, accounts: [account("a", { mix: { stocks: 3, bonds: 1, cash: 0, crypto: 0 } as never })] }, base)
  assert.equal(parsed, null, "shares above 1 are rejected")
  const ok = parsePlanDocument({ ...base, accounts: [account("a", { mix: { stocks: 0.6, bonds: 0.2, cash: 0, crypto: 0 } })] }, base)
  assert.ok(Math.abs((ok?.accounts[0].mix?.stocks ?? 0) - 0.75) < 1e-12)
})
