import test from "node:test"
import assert from "node:assert/strict"
import { taxBase, type TaxSituation } from "@/lib/plans/tax/tax-calc"
import { bracketCeiling, largestAddition, magi, roomInLtcgZero, roomToBracket, roomToTaxable, roomUnderIrmaa, taxableIncome } from "@/lib/plans/tax/conversion-room"

const single: TaxSituation = { status: "single", state: null, index: 1, year: 2026 }
const joint: TaxSituation = { status: "joint", state: null, index: 1, year: 2026 }
const BIG = 10_000_000

function close(actual: number, expected: number, tolerance = 2) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`)
}

test("bracketCeiling: next threshold, indexed; none for the top bracket", () => {
  assert.equal(bracketCeiling("single", 0.22, 1), 105_700)
  assert.equal(bracketCeiling("joint", 0.12, 1), 100_800)
  close(bracketCeiling("single", 0.22, 1.1) ?? 0, 116_270, 0.01)
  assert.equal(bracketCeiling("single", 0.37, 1), null)
})

test("largestAddition: all, none, or the edge", () => {
  assert.equal(largestAddition(100, () => true), 100)
  assert.equal(largestAddition(100, () => false), 0)
  close(largestAddition(1000, (x) => x <= 437), 437)
})

test("roomToBracket fills taxable ordinary income to the top of the bracket after the deduction", () => {
  const b = taxBase({ ordinary: 50_000 })
  // 22% tops out at $105,700 taxable; the standard deduction is $16,100.
  close(roomToBracket(b, single, BIG, 0.22), 105_700 + 16_100 - 50_000)
  close(taxableIncome(taxBase({ ordinary: 50_000 + roomToBracket(b, single, BIG, 0.22) }), single).ordinary, 105_700)
  assert.equal(roomToBracket(taxBase({ ordinary: 200_000 }), single, BIG, 0.22), 0)
  assert.equal(roomToBracket(b, single, 10_000, 0.22), 10_000)
})

test("roomToBracket accounts for Social Security becoming taxable", () => {
  const b = taxBase({ ordinary: 20_000, socialSecurity: 40_000 })
  const room = roomToBracket(b, joint, BIG, 0.12)
  const after = taxableIncome(taxBase({ ordinary: 20_000 + room, socialSecurity: 40_000 }), joint).ordinary
  close(after, 100_800)
  // Taxable SS rises with the conversion, so the room is less than the naive gap.
  assert.ok(room < 100_800 + 32_200 - 20_000)
})

test("roomToTaxable counts long-term gains in taxable income", () => {
  const b = taxBase({ ordinary: 30_000, longGains: 20_000 })
  close(roomToTaxable(b, single, BIG, 80_000), 80_000 + 16_100 - 50_000)
})

test("roomUnderIrmaa stays below the first tier line", () => {
  const b = taxBase({ ordinary: 60_000 })
  const room = roomUnderIrmaa(b, single, BIG, 0)
  assert.ok(magi(taxBase({ ordinary: 60_000 + room }), single) < 109_000)
  close(room, 109_000 - 1 - 60_000)
  close(roomUnderIrmaa(b, joint, BIG, 1), 274_000 - 1 - 60_000)
})

test("roomInLtcgZero keeps gains in the 0% bracket; no limit without gains", () => {
  const b = taxBase({ ordinary: 20_000, longGains: 10_000 })
  // 0% ends at $49,450 taxable: ordinary taxable can grow until ordinary + gains reach it.
  close(roomInLtcgZero(b, single, BIG), 49_450 - 10_000 + 16_100 - 20_000)
  assert.equal(roomInLtcgZero(taxBase({ ordinary: 20_000 }), single, 5_000), 5_000)
})
