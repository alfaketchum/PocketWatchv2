import test from "node:test"
import assert from "node:assert/strict"
import { stressTabFrom, STRESS_TABS } from "@/components/plans/stress/stress-tab-names"

test("a ?tab= value picks its tab; anything else opens the Summary", () => {
  assert.equal(stressTabFrom("improve"), "improve")
  assert.equal(stressTabFrom("setup"), "setup")
  assert.equal(stressTabFrom(null), "summary")
  assert.equal(stressTabFrom("nonsense"), "summary")
  assert.deepEqual(STRESS_TABS.map((t) => t.value), ["summary", "improve", "outcomes", "trials", "setup"])
})
