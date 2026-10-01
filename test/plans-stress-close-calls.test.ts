import test from "node:test"
import assert from "node:assert/strict"
import { closeCall } from "@/lib/plans/stress/stress-close-calls"
import { outcomeBuckets } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"
import type { YearRow } from "@/lib/plans/plan-types"

/** A year with `money` in the accounts and $50k of spending; `living` = drawing on the accounts. */
const row = (index: number, money: number, living = true, shortfall = 0) =>
  ({ index, accountsTotal: money, expenses: 40_000, debtPayments: 10_000, withdrawals: living ? 50_000 : 0, shortfall }) as YearRow

test("working years don't count, however small the balance", () => {
  const c = closeCall([row(0, 10_000, false), row(1, 1_000_000)], 40)
  assert.deepEqual(c.lowPoint, { years: 20, age: 41 })
  assert.equal(c.dangerArea, 0)
})

test("lowest point in years of spending, and the area under a 3-year line", () => {
  // 10 yrs, 1.5 yrs (half the line: 0.5), 0 (a full danger-year), then out of money (another full one).
  const c = closeCall([row(0, 500_000), row(1, 75_000), row(2, 0), row(3, 0, false, 50_000)], 60)
  assert.deepEqual(c.lowPoint, { years: 0, age: 62 })
  assert.ok(Math.abs(c.dangerArea - 2.5) < 1e-9)
})

const run = (year: number, end: number, low: number, area: number, depletedAge: number | null = null): CohortResult => ({
  year, cape: null, avgInflation: null, depletedAge, netWorth: [end], invested: [end], lowPoint: { years: low, age: 70 + low }, dangerArea: area,
})

test("each bucket gives its typical lowest point and danger-years", () => {
  const b = outcomeBuckets([run(1950, 2e6, 8, 0), run(1951, 2e6, 1.5, 1), run(1952, 2e6, 4, 0.2), run(1929, 0, 0, 6, 70)], {
    startValue: 1e6, yearlySpending: 50_000, endAge: 95, measure: "invested",
  })
  const by = Object.fromEntries(b.map((x) => [x.key, x]))
  assert.deepEqual(by.surplus.lowPoint, { years: 4, age: 74 })
  assert.ok(Math.abs(by.surplus.dangerArea! - 0.2) < 1e-9)
  assert.equal(by.catastrophic.lowPoint, undefined, "ran out: the low point is $0, so only the area is shown")
  assert.equal(by.catastrophic.dangerArea, 6)
  assert.equal(by.steady.dangerArea, undefined)
})

test("cushion bands skip ages when most periods are still working", async () => {
  const { cushionBands } = await import("@/lib/plans/stress/stress-cushion")
  const b = cushionBands([
    [null, 10, 2],
    [null, 20, 0],
    [5, null, 4],
  ])
  assert.equal(b[0], null, "only 1 of 3 living off their accounts")
  assert.equal(b[1]![2], 15, "median of 10 and 20")
  assert.equal(b[2]![2], 2)
  assert.deepEqual(closeCall([row(0, 10_000, false), row(1, 100_000)], 40).cushion, [null, 2])
})
