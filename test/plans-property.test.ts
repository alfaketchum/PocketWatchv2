import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { saleGainFor, assetEntries } from "@/lib/plans/engine/engine-assets"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { livesIn, typicalRunningCosts } from "@/lib/plans/plan-asset-costs"
import { rentalIncomes } from "@/lib/plans/plan-rentals"
import { timingContext } from "@/lib/plans/plan-timing"
import type { PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import { saltCap } from "@/lib/plans/tax/itemized-2026"
import { federalDeduction, stateTax, taxBase } from "@/lib/plans/tax/tax-calc"

const NOW = new Date(2026, 0, 15)

function plan(extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 40)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: "NJ", filingStatus: "single", inflation: 0, cashBuffer: 0, endAge: 50 },
    accounts: [{ ...base.accounts[0], balance: 2_000_000, returnRate: 0 }],
    incomes: [{ id: "w", name: "Salary", kind: "salary", amount: 200_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, taxable: true, oneTime: false, contributions: [] }],
    expenses: [],
    ...extra,
  }
}

const home = (extra: Partial<PlanAsset> = {}): PlanAsset => ({
  id: "h",
  name: "Home",
  kind: "home",
  value: 1_000_000,
  appreciation: 0,
  start: { type: "planStart" },
  end: { type: "planEnd" },
  ...extra,
})

test("SALT cap: $40,400 in 2026, back to $10,000 from 2030, phased down at high income", () => {
  assert.equal(saltCap(2026, 100_000), 40_400)
  assert.equal(saltCap(2030, 100_000), 10_000)
  assert.equal(saltCap(2025, 600_000), 10_000)
  assert.equal(saltCap(2025, 550_000), 25_000)
})

test("federal deduction: itemizes when SALT + mortgage interest beat the standard deduction", () => {
  const b = taxBase({ ordinary: 200_000 })
  const s = { status: "single" as const, state: "NJ", index: 1 }
  assert.deepEqual(federalDeduction(b, s, 10_000), { amount: 16_100, itemized: false })
  const it = { year: 2026, propertyTax: 22_000, residenceTax: 22_000, mortgageInterest: 20_000 }
  const d = federalDeduction(b, { ...s, itemized: it }, 10_000)
  assert.equal(d.itemized, true)
  assert.equal(d.amount, 32_000 + 20_000)
})

test("NJ property-tax deduction lowers state tax on a home you live in (up to $15,000)", () => {
  const b = taxBase({ ordinary: 200_000 })
  const s = { status: "single" as const, state: "NJ", index: 1 }
  const without = stateTax(b, s)
  const withHome = stateTax(b, { ...s, itemized: { year: 2026, propertyTax: 22_000, residenceTax: 22_000, mortgageInterest: 0 } })
  assert.ok(withHome < without)
  const rentedOnly = stateTax(b, { ...s, itemized: { year: 2026, propertyTax: 22_000, residenceTax: 0, mortgageInterest: 0 } })
  assert.equal(rentedOnly, without)
})

test("typical home costs use the state's property tax rate", () => {
  const nj = typicalRunningCosts("home", "NJ").find((c) => c.kind === "propertyTax")
  assert.ok(nj && Math.abs(nj.amount - 0.0223) < 1e-9)
  assert.equal(typicalRunningCosts("home", null).find((c) => c.kind === "propertyTax")?.amount, 0.011)
})

test("home-sale exclusion only for a home you live in", () => {
  const doc = plan()
  const ctx = timingContext(doc)
  const rules = { capitalGainsRate: 0.15, incomeTaxRate: 0.3, joint: false }
  const sold = (asset: PlanAsset) => saleGainFor(assetEntries([asset], ctx, 0)[0], 5, rules)
  const bought = home({ costBasis: 600_000 })
  assert.equal(livesIn(bought), true)
  assert.equal(sold(bought), 400_000 - 250_000)
  const inherited = home({ acquired: "received", costBasis: 600_000 })
  assert.equal(livesIn(inherited), false)
  assert.equal(sold(inherited), 400_000)
  assert.equal(sold({ ...inherited, primaryResidence: true }), 150_000)
  assert.equal(sold({ ...bought, rental: { monthlyRent: 3_000, start: null, vacancy: 0, managementFee: 0, growth: null } }), 400_000)
})

test("itemizing NJ property tax lowers the plan's income tax", () => {
  const costs = typicalRunningCosts("home", "NJ")
  const withTax = simulatePlan(plan({ assets: [home({ runningCosts: costs })] })).rows[0]
  const renamed = costs.map((c) => ({ ...c, kind: undefined, name: c.kind ? "Fees" : c.name }))
  const noDeduction = simulatePlan(plan({ assets: [home({ runningCosts: renamed })] })).rows[0]
  assert.equal(withTax.expenses, noDeduction.expenses, "same costs either way")
  assert.ok(withTax.deduction?.itemized)
  assert.ok(withTax.incomeTax < noDeduction.incomeTax)
})

test("rent is income; only rent past costs and depreciation is taxed", () => {
  const rental = { monthlyRent: 5_000, start: null, vacancy: 0, managementFee: 0.1, growth: 0 }
  const doc = plan({ assets: [home({ costBasis: 550_000, rental, runningCosts: [{ name: "Property tax", amount: 10_000, basis: "dollars", kind: "propertyTax" }] })] })
  assert.equal(rentalIncomes(doc)[0].amount, 54_000)
  const row = simulatePlan(doc).rows[0]
  assert.equal(row.incomeBy["rent-h"], 54_000)
  // 54,000 rent − 10,000 property tax − 550,000 × 80% / 27.5 depreciation
  assert.ok(Math.abs(row.rentalTaxable - (54_000 - 10_000 - 16_000)) < 1e-6)
  assert.equal(row.deduction?.itemized, false, "a rented home's property tax isn't SALT")
})
