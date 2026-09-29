import test from "node:test"
import assert from "node:assert/strict"
import {
  baristaGap,
  baristaNumber,
  coastNumber,
  fireNumber,
  projectPath,
  tierForSpend,
  yearsToCoast,
  yearsToTarget,
} from "@/lib/fire/fire-projection"
import { capeWithdrawalRate } from "@/lib/fire/cape-rule"
import { DEFAULT_TIERS } from "@/lib/fire/fire-constants"

function assertClose(actual: number, expected: number, tolerance: number, message?: string) {
  const diff = Math.abs(actual - expected)
  assert.ok(diff < tolerance, message ?? `Expected ${actual} to be within ${tolerance} of ${expected} (diff: ${diff})`)
}

test("fireNumber: 40k spend at 4% is 1M", () => {
  assert.equal(fireNumber(40_000, 0.04), 1_000_000)
})

test("yearsToTarget: matches year-by-year compounding", () => {
  const years = yearsToTarget(100_000, 50_000, 0.05, 1_000_000)
  assert.ok(years !== null)
  const path = projectPath(100_000, 50_000, 0.05, 30, 20, 2026)
  const firstAbove = path.findIndex((p) => p.value >= 1_000_000)
  assert.equal(Math.ceil(years), firstAbove)
})

test("yearsToTarget: zero return is linear, already-there is 0, impossible is null", () => {
  assert.equal(yearsToTarget(0, 10_000, 0, 100_000), 10)
  assert.equal(yearsToTarget(200, 0, 0.05, 100), 0)
  assert.equal(yearsToTarget(0, 0, 0.05, 100), null)
})

test("coastNumber: discounts target by real return", () => {
  assertClose(coastNumber(1_000_000, 30, 0.05), 1_000_000 / Math.pow(1.05, 30), 1e-6)
  assert.equal(coastNumber(1_000_000, 0, 0.05), 1_000_000)
})

test("yearsToCoast: 0 when already coasting, positive otherwise", () => {
  assert.equal(yearsToCoast(500_000, 20_000, 0.05, 1_000_000, 30), 0)
  const n = yearsToCoast(10_000, 20_000, 0.05, 1_000_000, 30)
  assert.ok(n !== null && n > 0 && n < 30)
})

test("barista: gap and number", () => {
  assert.equal(baristaGap(60_000, 1_000_000, 0.04), 20_000)
  assert.equal(baristaGap(30_000, 1_000_000, 0.04), 0)
  assert.equal(baristaNumber(60_000, 20_000, 0.04), 1_000_000)
})

test("tierForSpend: picks the smallest tier covering spend", () => {
  assert.equal(tierForSpend(DEFAULT_TIERS, 35_000), "lean")
  assert.equal(tierForSpend(DEFAULT_TIERS, 90_000), "chubby")
  assert.equal(tierForSpend(DEFAULT_TIERS, 1_000_000), "fat")
})

test("CAPE rule: CAPE 30 with ERN defaults ≈ 3.42%", () => {
  assertClose(capeWithdrawalRate(30, 0.0175, 0.5), 0.0175 + 0.5 / 30, 1e-12)
})
