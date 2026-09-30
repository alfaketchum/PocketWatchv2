import test from "node:test"
import assert from "node:assert/strict"
import { alignToTotal } from "@/lib/portfolio/composition-align"

const DAY = 86_400_000
const comp = [
  { t: 0, values: { stablecoin: 50, digital: 50 } },
  { t: DAY, values: { stablecoin: 0, digital: 0 } },
  { t: 2 * DAY, values: { stablecoin: 30, digital: 90 }, details: { digital: [{ label: "ETH", value: 60 }] } },
]

test("layers add up to the Total value at every Total point", () => {
  const total = [{ time: 0, value: 200 }, { time: DAY / 1000 + 3600, value: 300 }, { time: (2 * DAY) / 1000 + 60, value: 240 }]
  const out = alignToTotal(comp, total)
  assert.equal(out.length, 3)
  out.forEach((p, i) => assert.equal(p.values.stablecoin + p.values.digital, total[i].value))
  assert.deepEqual(out[0].values, { stablecoin: 100, digital: 100 })
  assert.deepEqual(out[1].values, { stablecoin: 150, digital: 150 }, "an empty day borrows the last mix")
  assert.deepEqual(out[2].values, { stablecoin: 60, digital: 180 })
  assert.equal(out[2].details?.digital[0].value, 120, "tooltip details scale too")
  assert.equal(out[2].t, (2 * DAY) + 60_000)
})

test("points before the breakdown starts use its first mix; no Total leaves it unchanged", () => {
  assert.deepEqual(alignToTotal(comp.slice(2), [{ time: 0, value: 12 }])[0].values, { stablecoin: 3, digital: 9 })
  assert.equal(alignToTotal(comp, []), comp)
})
