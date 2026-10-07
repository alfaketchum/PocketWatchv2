import test from "node:test"
import assert from "node:assert/strict"
import { stressTabFrom, STRESS_TABS } from "@/components/plans/stress/stress-tab-names"

test("a ?tab= value picks its tab; anything else opens Setup, the first thing you do", () => {
  assert.equal(stressTabFrom("improve"), "improve")
  assert.equal(stressTabFrom("summary"), "summary")
  assert.equal(stressTabFrom(null), "setup")
  assert.equal(stressTabFrom("nonsense"), "setup")
  assert.deepEqual(STRESS_TABS.map((t) => t.value), ["setup", "summary", "improve", "outcomes", "trials"])
})
