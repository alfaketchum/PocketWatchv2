import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  constantEquity,
  defaultSimOptions,
  failsafe,
  maxSafeWr,
  parseDataset,
  simulateCohort,
  successRate,
  summarizeCohorts,
} from "@/lib/fire/swr-simulation"
import { buildSwrGrid } from "@/lib/fire/swr-grid"
import type { MarketHistory, ShillerDataset } from "@/lib/fire/fire-types"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

function syntheticHistory(months: number, monthlyReturn: number): MarketHistory {
  return {
    months: Array.from({ length: months }, (_, i) => `m${i}`),
    equity: new Float64Array(months).fill(monthlyReturn),
    bonds: new Float64Array(months).fill(monthlyReturn),
    cape: new Array(months).fill(20),
    dataThrough: "",
    latestCape: 20,
    latestCapeMonth: "",
  }
}

const real = parseDataset(
  JSON.parse(readFileSync(join(process.cwd(), "src/lib/fire/data/shiller-monthly.json"), "utf8")) as ShillerDataset,
)

test("maxSafeWr: closed form depletes the portfolio exactly to the target", () => {
  const h = syntheticHistory(400, 0.004)
  for (const finalValue of [0, 0.5, 1]) {
    const opts = defaultSimOptions({ horizonMonths: 360, finalValue, feeAnnual: 0 })
    const wr = maxSafeWr(h, 0, opts)
    const path = simulateCohort(h, 0, wr, opts)
    assertClose(path[path.length - 1], finalValue, 1e-9)
  }
})

test("maxSafeWr: 0% real return with 100% final value → ~0% WR", () => {
  const h = syntheticHistory(400, 0)
  const wr = maxSafeWr(h, 0, defaultSimOptions({ horizonMonths: 360, finalValue: 1, feeAnnual: 0 }))
  assertClose(wr, 0, 1e-12)
})

test("maxSafeWr: 0% real return, deplete over 30y → 1/30", () => {
  const h = syntheticHistory(400, 0)
  const wr = maxSafeWr(h, 0, defaultSimOptions({ horizonMonths: 360, feeAnnual: 0 }))
  assertClose(wr, 1 / 30, 1e-12)
})

test("supplemental income raises the safe withdrawal rate", () => {
  const base = defaultSimOptions({ horizonMonths: 600 })
  const withFlow = { ...base, flows: [{ startMonth: 240, endMonth: 600, amount: 0.01 / 12 }] }
  assert.ok(maxSafeWr(real, 0, withFlow) > maxSafeWr(real, 0, base))
})

test("grid (prefix sums) agrees with per-cohort closed form", () => {
  const cell = buildSwrGrid(real, 0, 0.04, [40], [0.6])[0]
  const summaries = summarizeCohorts(real, defaultSimOptions({ horizonMonths: 480, equity: constantEquity(0.6) }))
  assertClose(cell.failsafeWr, failsafe(summaries)!.wr, 1e-9)
})

test("real data: ERN headline — 60y, 75/25 failsafe ≈ 3.25% (1929 cohort)", () => {
  const opts = defaultSimOptions({ horizonMonths: 720, equity: constantEquity(0.75) })
  const worst = failsafe(summarizeCohorts(real, opts))!
  assertClose(worst.wr, 0.0325, 0.002)
  assert.ok(worst.month.startsWith("1929"))
})

test("real data: 30y, 75/25 — 4% rule works in most but not all cohorts; 1966 is worst", () => {
  const opts = defaultSimOptions({ horizonMonths: 360, equity: constantEquity(0.75) })
  const rate = successRate(real, 0.04, opts)!
  assert.ok(rate > 0.9 && rate < 1, `4% success ${rate}`)
  const worst = failsafe(summarizeCohorts(real, opts))!
  assertClose(worst.wr, 0.037, 0.003)
  assert.ok(worst.month.startsWith("1966") || worst.month.startsWith("1965"))
})
