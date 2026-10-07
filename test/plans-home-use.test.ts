import test from "node:test"
import assert from "node:assert/strict"
import { livesIn } from "@/lib/plans/plan-asset-costs"
import { homeUse, withHomeUse } from "@/lib/plans/plan-rentals"
import type { PlanAsset } from "@/lib/plans/plan-types"

const home = (extra: Partial<PlanAsset> = {}): PlanAsset => ({ id: "h", name: "Home", kind: "home", value: 1_000_000, appreciation: 0.03, start: { type: "planStart" }, end: { type: "planEnd" }, ...extra })

test("a home's use: lived in, rented out or neither, matching the tax rules", () => {
  assert.equal(homeUse(home()), "live", "a home you buy is lived in unless unticked")
  assert.equal(homeUse(home({ acquired: "received" })), "other", "an inherited one isn't, unless ticked")
  const rented = { ...home({ acquired: "received" }), ...withHomeUse(home(), "rented") }
  assert.equal(homeUse(rented), "rented")
  assert.equal(rented.rental?.monthlyRent, 4_000, "a first guess of 0.4% of the value a month")
  assert.equal(livesIn(rented), false)
})

test("switching use keeps an existing rent, and stopping clears it", () => {
  const rented = { ...home(), rental: { monthlyRent: 12_000, start: null, vacancy: 0.05, managementFee: 0.08, growth: null } }
  assert.equal(withHomeUse(rented, "rented").rental?.monthlyRent, 12_000)
  assert.deepEqual(withHomeUse(rented, "live"), { rental: undefined, primaryResidence: true })
  assert.deepEqual(withHomeUse(rented, "other"), { rental: undefined, primaryResidence: false })
})
