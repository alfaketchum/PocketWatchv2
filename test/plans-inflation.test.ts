import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { latestFromCsv, toMarketInflation } from "@/lib/plans/market-inflation-parse"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { equivalentRate, inflationOf, marketPath, marketRateFor, priceIndex, rateAt } from "@/lib/plans/plan-inflation"
import { keepRealReturns, shownReturn, storedReturn, withSettings } from "@/lib/plans/plan-returns"
import type { MarketInflation, PlanDocument } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)
const flat = (r: number): MarketInflation => ({ asOf: "2026-09-30", y5: r, y5y5: r, y10: r, y20: r, y30: r })

test("FRED CSV: the latest real value, skipping missing days", () => {
  assert.deepEqual(latestFromCsv("observation_date,T10YIE\n2026-09-29,2.35\n2026-09-30,."), { date: "2026-09-29", value: 2.35 })
  assert.equal(latestFromCsv("observation_date,T10YIE\n"), null)
})

test("breakevens from FRED series; 20/30-year as Treasury minus TIPS", () => {
  const v = (date: string, value: number) => ({ date, value })
  const m = toMarketInflation({
    T5YIE: v("2026-09-30", 2.36), T5YIFR: v("2026-09-30", 2.36), T10YIE: v("2026-09-30", 2.36),
    DGS20: v("2026-09-29", 5.64), DFII20: v("2026-09-29", 3.15), DGS30: v("2026-09-29", 5.59), DFII30: v("2026-09-29", 3.29),
  })
  assert.equal(m.asOf, "2026-09-30")
  close(m.y20, 0.0249, 1e-12)
  close(m.y30, 0.023, 1e-12)
})

test("price index: one rate compounds; a path multiplies each year's rate", () => {
  close(priceIndex(0.03, 10), Math.pow(1.03, 10))
  const path = marketPath({ asOf: "x", y5: 0.02, y5y5: 0.03, y10: 0.025, y20: 0.025, y30: 0.025 }, 40)
  close(priceIndex(path, 7), Math.pow(1.02, 5) * Math.pow(1.03, 2))
  assert.equal(rateAt(path, 4), 0.02)
  assert.equal(rateAt(path, 5), 0.03)
})

test("market path: forwards between breakevens, and the same price level as the single rate it equals", () => {
  const m = { asOf: "x", y5: 0.0236, y5y5: 0.0236, y10: 0.0236, y20: 0.0249, y30: 0.023 }
  const path = marketPath(m, 60)
  // 10→20 forward: (1.0249^20 / 1.0236^10)^(1/10) − 1
  close(rateAt(path, 12), Math.pow(Math.pow(1.0249, 20) / Math.pow(1.0236, 10), 0.1) - 1)
  close(priceIndex(path, 30), Math.pow(1.023, 30), 1e-9)
  const eq = equivalentRate(path, 60)
  close(Math.pow(1 + eq, 60), priceIndex(path, 60), 1e-6)
  assert.deepEqual(marketRateFor(m, 59), { rate: 0.023, horizon: 30 })
  assert.deepEqual(marketRateFor(m, 6), { rate: 0.0236, horizon: 5 })
})

test("engine on a flat market path matches the same single rate; a rising path costs more later", () => {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  const doc: PlanDocument = {
    ...base,
    settings: { ...base.settings, inflation: 0.025, endAge: 70 },
    accounts: [{ ...base.accounts[0], balance: 1_000_000, returnRate: 0.05 }],
    expenses: [{ id: "e", name: "Living", category: null, amount: 40_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  }
  const constant = simulatePlan(doc).rows
  const pathDoc = { ...doc, settings: { ...doc.settings, inflationMode: "marketPath" as const, marketInflation: flat(0.025) } }
  assert.equal(typeof inflationOf(pathDoc.settings), "object")
  const onPath = simulatePlan(pathDoc).rows
  close(onPath.at(-1)!.expenses, constant.at(-1)!.expenses, 1e-6)
  close(onPath.at(-1)!.incomeTax, constant.at(-1)!.incomeTax, 1e-6)
  const rising = { ...pathDoc, settings: { ...pathDoc.settings, marketInflation: { ...flat(0.025), y20: 0.03, y30: 0.035 } } }
  assert.ok(simulatePlan(rising).rows.at(-1)!.expenses > constant.at(-1)!.expenses)
})

test("real vs nominal: on a varying inflation path, account returns keep their real value", () => {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  const m: MarketInflation = { asOf: "2026-09-30", y5: 0.02, y5y5: 0.03, y10: 0.025, y20: 0.028, y30: 0.03 }
  const doc: PlanDocument = {
    ...base,
    settings: { ...base.settings, inflation: 0.025, endAge: 60, cashBuffer: 0, inflationMode: "marketPath", marketInflation: m },
    accounts: [{ ...base.accounts[1], balance: 1_000_000, returnRate: 0.055 }],
    incomes: [],
    expenses: [],
  }
  const real = 1.055 / 1.025 - 1
  const rows = simulatePlan(doc).rows
  const path = inflationOf(doc.settings)
  for (const r of [rows[3], rows[12], rows.at(-1)!]) {
    const todays = r.accountsTotal / priceIndex(path, r.index + 1)
    close(todays, 1_000_000 * Math.pow(1 + real, r.index + 1), 1e-3)
  }
})

test("returns entered after inflation: shown real, stored nominal, and they stay real when inflation changes", () => {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  const doc: PlanDocument = { ...base, settings: { ...base.settings, inflation: 0.03, returnBasis: "real" }, accounts: [{ ...base.accounts[1], returnRate: storedReturn(0.05, { inflation: 0.03, returnBasis: "real" }) }] }
  close(doc.accounts[0].returnRate, 0.0815, 1e-4)
  close(shownReturn(doc.accounts[0].returnRate, doc.settings), 0.05, 1e-4)
  const lower = withSettings(doc, { inflation: 0.023 })
  close(shownReturn(lower.accounts[0].returnRate, lower.settings), 0.05, 1e-4)
  close(lower.accounts[0].returnRate, 1.05 * 1.023 - 1, 1e-4)
  const nominalDoc = { ...doc, settings: { ...doc.settings, returnBasis: "nominal" as const } }
  assert.equal(withSettings(nominalDoc, { inflation: 0.023 }).accounts[0].returnRate, doc.accounts[0].returnRate, "before-inflation returns stay as entered")
  close(keepRealReturns(nominalDoc, 0.03, 0.023).accounts[0].returnRate, lower.accounts[0].returnRate, 1e-9)
})
