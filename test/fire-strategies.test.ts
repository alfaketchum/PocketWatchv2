import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fiDateRange } from "@/lib/fire/fi-date-range"
import { simulateStrategy, summarizeStrategy, type StrategyOptions } from "@/lib/fire/withdrawal-strategies"
import { fiSensitivity } from "@/lib/fire/fire-sensitivity"
import { yearsToTarget } from "@/lib/fire/fire-projection"
import { constantEquity, defaultSimOptions, parseDataset, simulateCohort, successRate } from "@/lib/fire/swr-simulation"
import type { MarketHistory, ShillerDataset } from "@/lib/fire/fire-types"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

const real = parseDataset(
  JSON.parse(readFileSync(join(process.cwd(), "src/lib/fire/data/shiller-monthly.json"), "utf8")) as ShillerDataset,
)

function flatHistory(months: number, monthly: number): MarketHistory {
  return {
    months: Array.from({ length: months }, (_, i) => `m${i}`),
    equity: new Float64Array(months).fill(monthly),
    bonds: new Float64Array(months).fill(monthly),
    cape: new Array(months).fill(25),
    dataThrough: "",
    latestCape: 25,
    latestCapeMonth: "",
  }
}

const BASE: StrategyOptions = {
  strategy: "fixed", wr: 0.04, horizonYears: 30, equity: constantEquity(0.75), feeAnnual: 0.0005, capeA: 0.0175, capeB: 0.5,
}

test("FI date range: flat returns give (nearly) one date that matches the closed form", () => {
  const monthly = Math.pow(1.05, 1 / 12) - 1
  const h = flatHistory(1200, monthly)
  const range = fiDateRange(h, {
    start: 200_000, annualContribution: 60_000, target: 1_000_000, equity: constantEquity(1), feeAnnual: 0, windfalls: [], bandYears: 15,
  })!
  const closed = yearsToTarget(200_000, 60_000, 0.05, 1_000_000)!
  assertClose(range.p50, closed, 0.5)
  assertClose(range.p10, range.p90, 1e-9)
})

test("FI date range on real data: percentiles ordered, bands widen over time", () => {
  const range = fiDateRange(real, {
    start: 500_000, annualContribution: 50_000, target: 1_500_000, equity: constantEquity(0.8), feeAnnual: 0.0005, windfalls: [], bandYears: 15,
  })!
  assert.ok(range.p10 <= range.p25 && range.p25 <= range.p50 && range.p50 <= range.p75 && range.p75 <= range.p90)
  const early = range.bands[2]
  const late = range.bands[10]
  assert.ok(late.p90 - late.p10 > early.p90 - early.p10)
})

test("fixed-dollar strategy matches the core engine's success rate", () => {
  const opts = defaultSimOptions({ horizonMonths: 360, equity: constantEquity(0.75) })
  const summary = summarizeStrategy(real, BASE)
  const engine = successRate(real, 0.04, opts)!
  assertClose(summary.successRate, engine, 0.01)
  const path = simulateStrategy(real, 0, BASE)
  const engineFinal = simulateCohort(real, 0, 0.04, opts)
  assertClose(path.finalValue, engineFinal[engineFinal.length - 1], 1e-6)
})

test("% of portfolio never depletes; guardrails and CAPE adapt spending", () => {
  assert.equal(summarizeStrategy(real, { ...BASE, strategy: "percent" }).successRate, 1)
  const idx1966 = real.months.indexOf("1966-01")
  const guard = simulateStrategy(real, idx1966, { ...BASE, strategy: "guardrails" })
  assert.ok(Math.min(...guard.spending) < 1, "guardrails cut spending in the 1966 cohort")
  const cape = simulateStrategy(real, idx1966, { ...BASE, strategy: "cape" })
  assert.ok(cape.spending[0] !== 1, "CAPE rule sets first-year spending from valuations")
})

test("sensitivity: every lever's better side is sooner, worse side later; ranked by impact", () => {
  const levers = fiSensitivity({ investable: 400_000, annualSpend: 60_000, annualContribution: 40_000, swr: 0.04, realReturn: 0.05, windfalls: [] })
  assert.deepEqual(levers.map((l) => l.key).sort(), ["invest", "returns", "spend", "swr"])
  for (const l of levers) {
    assert.ok((l.better.deltaYears ?? 0) < 0, `${l.key} better`)
    assert.ok((l.worse.deltaYears ?? 0) > 0, `${l.key} worse`)
  }
  for (let i = 1; i < levers.length; i++) assert.ok(levers[i].impact <= levers[i - 1].impact)
})
