import test from "node:test"
import assert from "node:assert/strict"
import { monthlyActual, progressStatus, valueAt } from "@/lib/plans/plan-progress"

test("valueAt interpolates inside the path and is null outside", () => {
  const path = [{ x: 2026, value: 100 }, { x: 2027, value: 200 }]
  assert.equal(valueAt(path, 2026.5), 150)
  assert.equal(valueAt(path, 2025), null)
  assert.equal(valueAt(path, 2028), null)
})

test("monthlyActual keeps the last point of each month", () => {
  const points = monthlyActual([
    { date: "2026-01-05", total: 1 },
    { date: "2026-01-31", total: 2 },
    { date: "2026-02-10", total: 3 },
  ])
  assert.deepEqual(points.map((p) => p.value), [2, 3])
})

test("progressStatus: ahead of plan is positive; before the plan starts is null", () => {
  const path = [{ x: 2026, value: 100 }, { x: 2027, value: 200 }]
  const status = progressStatus(path, [{ x: 2026.5, value: 170 }])
  assert.equal(status?.difference, 20)
  assert.equal(progressStatus(path, [{ x: 2025.5, value: 170 }]), null)
})
