import test from "node:test"
import assert from "node:assert/strict"
import {
  baristaNumber,
  coastNumber,
  fireNumber,
  projectPath,
  tierForSpend,
  yearsToCoast,
  yearsToTarget,
} from "@/lib/fire/fire-projection"
import { capeWithdrawalRate } from "@/lib/fire/cape-rule"
import { DEFAULT_FIRE_INPUTS, DEFAULT_TIERS } from "@/lib/fire/fire-constants"

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

test("barista: part-time for life is the classic (spend − income) ÷ SWR", () => {
  assert.equal(baristaNumber(60_000, 20_000, 0.04, 0.05, null), 1_000_000)
})

test("barista bridge: 0 years = full FIRE number; more years = smaller number; never above full", () => {
  const full = 60_000 / 0.04
  assert.equal(baristaNumber(60_000, 20_000, 0.04, 0.05, 0), full)
  const five = baristaNumber(60_000, 20_000, 0.04, 0.05, 5)
  const ten = baristaNumber(60_000, 20_000, 0.04, 0.05, 10)
  assert.ok(ten < five && five < full, `${ten} < ${five} < ${full}`)
  assert.ok(ten > baristaNumber(60_000, 20_000, 0.04, 0.05, null), "a finite bridge needs more than part-time for life")
  assert.equal(baristaNumber(60_000, 0, 0.04, 0, 10), full, "no part-time income at 0% return can't beat full FIRE")
})

test("barista bridge: 0% return is linear (full number + gap × years)", () => {
  // A positive gap with no growth needs more than the full number, so it's capped there.
  assert.equal(baristaNumber(60_000, 50_000, 0.04, 0, 10), 1_500_000)
  assertClose(baristaNumber(60_000, 70_000, 0.04, 0, 10), 1_500_000 - 100_000, 1e-6)
})

test("barista bridge: the deterministic path lands exactly on the full FIRE number", () => {
  const r = 0.05
  const years = 8
  let v = baristaNumber(60_000, 25_000, 0.04, r, years)
  for (let i = 0; i < years; i++) v = v * (1 + r) - (60_000 - 25_000)
  assertClose(v, 60_000 / 0.04, 1e-3)
})

test("tierForSpend: picks the smallest tier covering spend", () => {
  assert.equal(tierForSpend(DEFAULT_TIERS, 35_000), "lean")
  assert.equal(tierForSpend(DEFAULT_TIERS, 90_000), "chubby")
  assert.equal(tierForSpend(DEFAULT_TIERS, 1_000_000), "fat")
})

test("CAPE rule: CAPE 30 with ERN defaults ≈ 3.42%", () => {
  assertClose(capeWithdrawalRate(30, 0.0175, 0.5), 0.0175 + 0.5 / 30, 1e-12)
})

test("windfalls: none matches the closed form; an inheritance before FI brings it forward", async () => {
  const { yearsToTargetWithWindfalls } = await import("@/lib/fire/fire-projection")
  const base = yearsToTarget(100_000, 50_000, 0.05, 1_000_000)!
  assertClose(yearsToTargetWithWindfalls(100_000, 50_000, 0.05, 1_000_000, [])!, base, 1e-12)
  const sooner = yearsToTargetWithWindfalls(100_000, 50_000, 0.05, 1_000_000, [{ yearsFromNow: 3, amount: 300_000 }])!
  assert.ok(sooner < base, `${sooner} should be < ${base}`)
  const late = yearsToTargetWithWindfalls(100_000, 50_000, 0.05, 1_000_000, [{ yearsFromNow: 40, amount: 300_000 }])!
  assertClose(late, base, 1e-12)
  assert.equal(yearsToTargetWithWindfalls(0, 0, 0.05, 100, [{ yearsFromNow: 2, amount: 500 }]), 2)
})

test("windfalls: an inheritance after retirement raises the safe withdrawal rate", async () => {
  const { simOptionsForPlan } = await import("@/lib/fire/fire-analysis")
  const { maxSafeWr, parseDataset } = await import("@/lib/fire/swr-simulation")
  const { readFileSync } = await import("node:fs")
  const h = parseDataset(JSON.parse(readFileSync("src/lib/fire/data/shiller-monthly.json", "utf8")))
  const base = simOptionsForPlan(DEFAULT_FIRE_INPUTS, 45, 1_500_000)
  const withLump = simOptionsForPlan(
    { ...DEFAULT_FIRE_INPUTS, lumpSums: [{ id: "i", label: "Inheritance", age: 60, amount: 500_000 }] },
    45,
    1_500_000,
  )
  assert.equal(withLump.flows.length, 1)
  assert.equal(withLump.flows[0].startMonth, 180)
  assert.ok(maxSafeWr(h, 0, withLump) > maxSafeWr(h, 0, base))
})
