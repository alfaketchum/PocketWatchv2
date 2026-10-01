import test from "node:test"
import assert from "node:assert/strict"
import { STATE_TAX } from "@/lib/plans/tax/state-2026"
import { STATE_HOMEOWNER } from "@/lib/plans/tax/state-homeowner-2026"
import { stateDeduction, stateTax, taxBase, type TaxSituation } from "@/lib/plans/tax/tax-calc"
import type { Itemized } from "@/lib/plans/tax/itemized-2026"

const home = (extra: Partial<Itemized> = {}): Itemized => ({ year: 2026, propertyTax: 15_000, residenceTax: 15_000, mortgageInterest: 30_000, mortgageDebt: 600_000, ...extra })
const at = (state: string, itemized?: Itemized, status: "single" | "joint" = "single"): TaxSituation => ({ status, state, index: 1, ...(itemized ? { itemized } : {}) })
const deduction = (state: string, income: number, itemized?: Itemized, status: "single" | "joint" = "single") =>
  stateDeduction(taxBase({ ordinary: income }), at(state, itemized, status), STATE_TAX[state])

test("every state and DC has homeowner rules", () => {
  assert.equal(Object.keys(STATE_HOMEOWNER).length, 51)
  for (const code of Object.keys(STATE_TAX)) assert.ok(STATE_HOMEOWNER[code], code)
})

test("California itemizes with no SALT cap and a $1M mortgage limit", () => {
  assert.equal(deduction("CA", 300_000, home()), 45_000)
  const big = home({ propertyTax: 30_000, residenceTax: 30_000, mortgageInterest: 90_000, mortgageDebt: 1_500_000 })
  assert.equal(deduction("CA", 300_000, big), 30_000 + 60_000)
})

test("North Carolina caps mortgage interest + property tax at $20,000", () => {
  assert.equal(deduction("NC", 200_000, home()), 20_000)
})

test("Kentucky allows mortgage interest but not property tax", () => {
  assert.equal(deduction("KY", 200_000, home()), 30_000)
})

test("Georgia itemizes only if itemizing federally, and caps property tax at $10,000", () => {
  assert.equal(deduction("GA", 200_000, home()), 10_000 + 30_000)
  const small = home({ propertyTax: 2_000, residenceTax: 2_000, mortgageInterest: 3_000 })
  assert.equal(deduction("GA", 200_000, small), STATE_TAX.GA.deduction?.single ?? 0, "federal standard wins, so the state's too")
})

test("Colorado starts from federal taxable income: the federal deduction flows through", () => {
  assert.equal(deduction("CO", 200_000), 16_100, "no itemizing: the federal standard deduction")
  assert.equal(deduction("CO", 200_000, home()), 15_000 + 30_000)
})

test("Louisiana adds only federal itemized beyond the federal standard deduction", () => {
  const standard = STATE_TAX.LA.deduction?.single ?? 0
  assert.equal(deduction("LA", 200_000, home()), standard + (45_000 - 16_100))
})

test("Indiana deducts up to $2,500 of home property tax; Utah and Pennsylvania give nothing", () => {
  assert.equal(deduction("IN", 100_000, home()) - deduction("IN", 100_000), 2_500)
  assert.equal(deduction("UT", 100_000, home()), deduction("UT", 100_000))
  assert.equal(deduction("PA", 100_000, home()), deduction("PA", 100_000))
})

test("Illinois: a 5% property tax credit under $250k single, none above", () => {
  const b = taxBase({ ordinary: 150_000 })
  assert.ok(Math.abs(stateTax(b, at("IL")) - stateTax(b, at("IL", home())) - 750) < 1e-6)
  const rich = taxBase({ ordinary: 300_000 })
  assert.equal(stateTax(rich, at("IL", home())), stateTax(rich, at("IL")))
})

test("Connecticut: a $300 credit that shrinks between $49,500 and $109,500 (single)", () => {
  const credit = (income: number) => stateTax(taxBase({ ordinary: income }), at("CT")) - stateTax(taxBase({ ordinary: income }), at("CT", home()))
  assert.ok(Math.abs(credit(40_000) - 300) < 1e-6)
  assert.ok(Math.abs(credit(79_500) - 150) < 1e-6)
  assert.equal(credit(120_000), 0)
})

test("Federal-SALT-cap states drop the property tax limit to $10,000 from 2030", () => {
  const big = home({ propertyTax: 25_000, residenceTax: 25_000, mortgageInterest: 0 })
  assert.equal(deduction("OR", 150_000, big), 25_000)
  assert.equal(deduction("OR", 150_000, { ...big, year: 2030 }), Math.max(10_000, STATE_TAX.OR.deduction!.single))
})
