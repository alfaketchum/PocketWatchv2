import test from "node:test"
import assert from "node:assert/strict"
import { outcomeBuckets } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

/** A trial that ran out of cash with nothing left (an ending of $0) went broke when it ran out. */
const run = (year: number, end: number, depletedAge: number | null = null): CohortResult => ({
  year, cape: null, avgInflation: null, depletedAge, netWorth: [end], invested: [end],
  ...(depletedAge !== null && end <= 0 ? { brokeAge: depletedAge } : {}),
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

test("on net worth, running out with net worth left is out of cash; only hitting $0 is catastrophic", () => {
  const worth = { ...yard, measure: "netWorth" as const }
  const outOfCash = { ...run(1929, 300_000, 70), lowestWorthAfterRunOut: 300_000 }
  const broke = { ...run(1937, 0, 70), lowestWorthAfterRunOut: 0 }
  const lateBroke = { ...run(1966, 0, 92), lowestWorthAfterRunOut: 0 }
  const by = Object.fromEntries(outcomeBuckets([outOfCash, broke, lateBroke], worth).map((x) => [x.key, x]))
  assert.deepEqual(by.outOfCash.years, [1929])
  assert.deepEqual(by.catastrophic.years, [1937])
  assert.deepEqual(by.almostSurvived.years, [1966])
  assert.match(by.catastrophic.rule, /assets exhausted/)
})

test("on net worth, running out after a home sale is catastrophic even with net worth left", () => {
  const worth = { ...yard, measure: "netWorth" as const }
  const sale = (age: number, planned: boolean) => ({ name: "Home", age, planned })
  const soldThenOut = { ...run(1929, 300_000, 70), lowestWorthAfterRunOut: 300_000, homeSales: [sale(65, false)] }
  const outBeforePlannedSale = { ...run(1937, 300_000, 70), lowestWorthAfterRunOut: 300_000, homeSales: [sale(80, true)] }
  const by = Object.fromEntries(outcomeBuckets([soldThenOut, outBeforePlannedSale], worth).map((x) => [x.key, x]))
  assert.deepEqual(by.catastrophic.years, [1929])
  assert.deepEqual(by.outOfCash.years, [1937], "the home hadn't been sold yet")
})

test("on money in accounts, running out is catastrophic even with net worth left", () => {
  const outOfCash = { ...run(1929, 300_000, 70), lowestWorthAfterRunOut: 300_000 }
  const by = Object.fromEntries(outcomeBuckets([outOfCash], { ...yard, measure: "invested" }).map((x) => [x.key, x]))
  assert.deepEqual(by.catastrophic.years, [1929])
  assert.equal(by.outOfCash.count, 0)
})
