import test from "node:test"
import assert from "node:assert/strict"
import { stressVerdict } from "@/lib/plans/stress/stress-verdict"

test("both rates high: holds up", () => {
  assert.deepEqual(stressVerdict(0.97, 0.99), { text: "Holds up in almost every market", tone: "good" })
})

test("net worth holds but the cash runs short in the worst markets", () => {
  assert.equal(stressVerdict(0.85, 0.99).text, "Net worth holds; the cash runs short in the worst markets")
  assert.equal(stressVerdict(0.85, 0.99).tone, "warn")
})

test("rich in property, short on cash: says so instead of reading as a failure", () => {
  const v = stressVerdict(0.52, 0.98)
  assert.equal(v.text, "Wealthy on paper, short on cash: the accounts run dry in 48% of markets, with property left")
  assert.equal(v.tone, "warn")
})

test("net worth hitting $0 is the failure, worded by how often", () => {
  assert.deepEqual(stressVerdict(0.5, 0.85), { text: "Goes broke in the worst markets (15%)", tone: "warn" })
  assert.deepEqual(stressVerdict(0.3, 0.4), { text: "Goes broke in 60% of markets", tone: "bad" })
})
