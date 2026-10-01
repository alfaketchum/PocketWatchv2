import test from "node:test"
import assert from "node:assert/strict"
import { mockHomeData, stateFromAddress } from "@/lib/finance/home-data/mock"
import { parseRentcast } from "@/lib/finance/home-data/rentcast"
import { homeDataToAsset } from "@/lib/finance/home-data/to-asset"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { assetsFromRealAssets } from "@/lib/plans/import/import-mapping"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { propertyTaxRate } from "@/lib/plans/tax/property-tax-rates"

const ADDRESS = "77 Hudson St, Jersey City, NJ 07302"

test("mock provider: stable per address, shaped like a real lookup, taxed near the state rate", () => {
  const a = mockHomeData(ADDRESS)
  assert.deepEqual(mockHomeData(ADDRESS), a, "same address, same data")
  assert.notEqual(mockHomeData("1 Main St, Austin, TX 78701").value, a.value)
  assert.equal(stateFromAddress(ADDRESS), "NJ")
  assert.ok(a.value >= 250_000 && a.value <= 2_000_000)
  const rate = a.propertyTax!.amount / a.value
  assert.ok(Math.abs(rate - propertyTaxRate("NJ")) / propertyTaxRate("NJ") <= 0.15, `NJ effective rate ${rate}`)
  assert.ok(a.rentEstimate! > 0 && a.lastSale!.price < a.value)
  assert.equal(a.source, "mock")
})

test("RentCast responses parse into one HomeData, using the latest tax year", () => {
  const home = parseRentcast(
    ADDRESS,
    {
      formattedAddress: "77 Hudson St, Jersey City, NJ 07302",
      propertyType: "Condo",
      bedrooms: 2,
      bathrooms: 2,
      squareFootage: 1150,
      yearBuilt: 2004,
      lastSaleDate: "2019-05-20T00:00:00.000Z",
      lastSalePrice: 640_000,
      hoa: { fee: 610 },
      taxAssessments: { "2023": { year: 2023, value: 520_000 }, "2024": { year: 2024, value: 540_000 } },
      propertyTaxes: { "2023": { year: 2023, total: 11_200 }, "2024": { year: 2024, total: 11_900 } },
    },
    { price: 760_000, priceRangeLow: 700_000, priceRangeHigh: 820_000 },
    { rent: 4_100 },
  )
  assert.ok(home)
  assert.deepEqual(home.propertyTax, { amount: 11_900, year: 2024 })
  assert.equal(home.assessedValue, 540_000)
  assert.equal(home.rentEstimate, 4_100)
  assert.deepEqual(home.lastSale, { price: 640_000, date: "2019-05-20" })
  assert.ok(Math.abs(home.effectiveTaxRate! - 11_900 / 760_000) < 1e-12)
  assert.equal(parseRentcast(ADDRESS, null, null, null), null, "no value estimate, no result")
})

test("a lookup fills the home: value, bill, rent, and the last sale only when no purchase was entered", () => {
  const home = mockHomeData(ADDRESS)
  const filled = homeDataToAsset(home, { purchasePrice: null }, new Date("2026-10-01"))
  assert.equal(filled.value, home.value)
  assert.equal(filled.propertyTaxAnnual, home.propertyTax!.amount)
  assert.equal(filled.purchasePrice, home.lastSale!.price)
  assert.equal(filled.dataAsOf, "2026-10-01")
  assert.equal(homeDataToAsset(home, { purchasePrice: 500_000 }).purchasePrice, undefined)
})

test("end to end: a looked-up home's real tax bill becomes its property tax in a plan", () => {
  const home = mockHomeData(ADDRESS)
  const filled = homeDataToAsset(home, { purchasePrice: null })
  const { assets } = assetsFromRealAssets(
    [{ id: "ra1", kind: "home", name: "Condo", value: filled.value, appreciation: 0, loanAccountId: null, propertyTaxAnnual: filled.propertyTaxAnnual }],
    [],
    "NJ",
  )
  const tax = assets[0].runningCosts!.find((c) => c.kind === "propertyTax")!
  assert.ok(Math.abs(tax.amount * filled.value - filled.propertyTaxAnnual!) < 1e-6, "bill as the home's own rate")
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  const doc = { ...base, settings: { ...base.settings, inflation: 0, endAge: 42 }, assets }
  const row = simulatePlan(doc).rows[0]
  const charged = Object.entries(row.expensesBy).find(([id]) => id === `cost-${assets[0].id}-0`)?.[1]
  assert.ok(charged !== undefined && Math.abs(charged - filled.propertyTaxAnnual!) < 1, `plan charges the bill: ${charged}`)
  assert.equal(assetsFromRealAssets([{ id: "ra2", kind: "home", name: "H", value: 500_000, appreciation: 0, loanAccountId: null }], [], "NJ").assets[0]
    .runningCosts!.find((c) => c.kind === "propertyTax")!.amount, propertyTaxRate("NJ"), "no bill: the state's rate")
})
