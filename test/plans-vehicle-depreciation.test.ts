import test from "node:test"
import assert from "node:assert/strict"
import { assetValue } from "@/lib/plans/engine/engine-assets"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { applyVehicle } from "@/lib/plans/milestone-templates"
import { expandPlan } from "@/lib/plans/plan-expand"
import { conditionOf, vehicleValueRatio, vehicleValueShare } from "@/lib/plans/vehicle-depreciation"
import type { PlanAsset } from "@/lib/plans/plan-types"

const close = (a: number, b: number, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

const car = (over: Partial<PlanAsset> = {}): PlanAsset => ({
  id: "car", name: "Car", kind: "vehicle", value: 50_000, appreciation: -0.15, start: { type: "planStart" }, end: { type: "planEnd" }, ...over,
})

test("the curve: ~20% the first year, ~45% by year 5, ~72% by year 10, never below the floor", () => {
  close(vehicleValueShare(1), 0.8)
  close(vehicleValueShare(5), 0.544, 2e-3)
  close(vehicleValueShare(10), 0.28, 3e-3)
  assert.ok(vehicleValueShare(60) >= 0.05)
  assert.ok(vehicleValueRatio(0, 1) < vehicleValueRatio(3, 1), "a new car drops faster than a 3-year-old one")
  assert.equal(conditionOf(0), "new")
  assert.equal(conditionOf(3), "preOwned")
  assert.equal(conditionOf(6), "used")
})

test("asset value follows the curve by age, in the plan's terms; without an age it keeps its flat rate", () => {
  close(assetValue(car({ vehicleAge: 0 }), 0, 1, 0, 0), 40_000)
  close(assetValue(car({ vehicleAge: 3 }), 0, 2, 0, 0), 50_000 * vehicleValueShare(5) / vehicleValueShare(3))
  close(assetValue(car(), 0, 2, 0, 0), 50_000 * 0.85 ** 2)
  // A purchase in year 4 costs today's price grown by inflation, then follows the curve from there.
  close(assetValue(car({ vehicleAge: 0 }), 4, 5, 0.03, 0.03), 50_000 * 1.03 ** 4 * 0.8)
})

test("buying used carries its age, and each replacement is bought at the same age", () => {
  let n = 0
  const doc = blankPlanDocument(new Date(2026, 0, 15), 35)
  const bought = applyVehicle(doc, { name: "Car", when: { type: "year", year: 2028 }, price: 26_000, payWith: "cash", downPayment: 0, rate: 0, termYears: 5, appreciation: -0.15, replaceEveryYears: 5, vehicleAge: 6 }, (p) => `${p}-${++n}`)
  const cars = expandPlan(bought).assets.filter((a) => a.kind === "vehicle")
  assert.ok(cars.length > 1)
  assert.ok(cars.every((a) => a.vehicleAge === 6))
})
