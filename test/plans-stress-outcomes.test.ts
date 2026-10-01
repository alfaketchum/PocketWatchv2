import test from "node:test"
import assert from "node:assert/strict"
import { outcomeBuckets } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const run = (year: number, end: number, depletedAge: number | null = null): CohortResult => ({
  year, cape: null, avgInflation: null, depletedAge, netWorth: [end], invested: [end],
})
const yard = { startValue: 1_000_000, yearlySpending: 50_000, endAge: 95, measure: "netWorth" as const }

test("each period lands in one bucket by this plan's own yardsticks", () => {
  const b = outcomeBuckets(
    [run(1950, 2_000_000), run(1960, 400_000), run(1965, 100_000), run(1966, 0, 92), run(1929, 0, 70), run(1973, 0, 90)],
    yard,
  )
  const by = Object.fromEntries(b.map((x) => [x.key, x.years]))
  assert.deepEqual(by.surplus, [1950], "ended above today's $1M")
  assert.deepEqual(by.steady, [1960], "between 5 years of spending ($250k) and $1M")
  assert.deepEqual(by.justMadeIt, [1965], "lasted with under $250k")
  assert.deepEqual(by.almostSurvived, [1966, 1973], "ran out at 90 or later")
  assert.deepEqual(by.catastrophic, [1929])
  assert.ok(Math.abs(b.reduce((s, x) => s + x.share, 0) - 1) < 1e-9)
  assert.match(b[1].rule, /\$250k–\$1\.0M/)
})

test("selling the home is its own outcome, and ran-out buckets say what home equity was left", () => {
  const sold = { ...run(1970, 300_000), soldHome: true }
  const broke = (year: number, equity: number) => ({ ...run(year, 0, 70), equityAtDepletion: equity })
  const b = outcomeBuckets([sold, broke(1929, 200_000), broke(1937, 400_000), broke(1966, 300_000)], yard)
  const by = Object.fromEntries(b.map((x) => [x.key, x]))
  assert.deepEqual(by.soldHome.years, [1970])
  assert.deepEqual(by.steady.years, [])
  assert.match(by.catastrophic.note ?? "", /\$300k of home equity/)
  assert.equal(by.surplus.note, undefined)
})
