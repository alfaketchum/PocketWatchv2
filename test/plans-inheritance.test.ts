import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { applyInheritance, inheritanceTaxFor, INHERITED_IRA_YEARS, type InheritedPart } from "@/lib/plans/milestone-templates"
import type { Relationship } from "@/lib/plans/tax/inheritance-tax"
import { HOME_SALE_EXCLUSION } from "@/lib/plans/engine/engine-assets"
import { planDocumentSchema, parsePlanDocument } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanDocument } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)
let n = 0
const newId = (p: string) => `${p}-${++n}`

/** No inflation, 20% income tax, 15% capital gains; plan runs 2026..2060. */
function plan(patch: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0.2, capitalGainsRate: 0.15, cashBuffer: 0, endAge: 70 },
    accounts: [{ ...base.accounts[0], returnRate: 0 }],
    ...patch,
  }
}
const row = (d: PlanDocument, year: number) => simulatePlan(d).rows.find((r) => r.year === year)!
const part = (p: Partial<InheritedPart>): InheritedPart => ({ kind: "cash", amount: 0, label: "", accountId: null, roth: false, ...p })
const inherit = (parts: InheritedPart[], stateTaxRate = 0) =>
  applyInheritance(plan(), { name: "Inheritance", when: { type: "year", year: 2030 }, parts, stateTaxRate }, newId)

test("inherited cash is not taxable income", () => {
  const d = inherit([part({ kind: "cash", amount: 100_000 })])
  assert.ok(planDocumentSchema.safeParse(d).success)
  assert.equal(row(d, 2030).income, 100_000)
  assert.equal(row(d, 2030).incomeTax, 0)
  assert.equal(row(d, 2030).taxableIncome, 0)
})

test("inherited stocks land in a taxable account at a stepped-up basis (no tax to sell)", () => {
  const d = inherit([part({ kind: "stocks", amount: 200_000 })])
  const acct = d.accounts.find((a) => a.name === "Inherited brokerage")!
  assert.equal(row(d, 2030).balances[acct.id], 200_000)
  assert.equal(row(d, 2030).deposits, 200_000)
  assert.equal(row(d, 2030).income, 0)
  // Spend from it next year: only the one year of growth since inheriting is a gain. Without the
  // step-up the whole $50k would count (≈ $7,500 of tax); with it the tax is a few hundred dollars.
  const spending = { ...d, expenses: [{ id: "e", name: "Spend", category: null, amount: 50_000, growth: 0, start: { type: "year" as const, year: 2031 }, end: { type: "year" as const, year: 2032 }, oneTime: false }] }
  assert.ok(row(spending, 2031).withdrawalTax < 1_000)
})

test("inherited property costs nothing to receive; a later sale is taxed only on the gain since", () => {
  const d = inherit([part({ kind: "realEstate", amount: 400_000, label: "Mom's house" })])
  const house = d.assets[0]
  assert.equal(house.acquired, "received")
  assert.equal(row(d, 2030).assetPurchases, 0)
  // "Value today" is in today's dollars: it grows with inflation (0% here) until it arrives, then 3%/yr.
  const atReceipt = 400_000
  // Sell a year later (no exclusion yet): only that year's appreciation is a gain.
  const sold = { ...d, assets: [{ ...house, end: { type: "year" as const, year: 2031 } }] }
  assert.ok(Math.abs(row(sold, 2031).saleTax - atReceipt * 0.03 * 0.15) < 0.01)
})

test("home sales get the exclusion after two years; other assets pay tax on the full gain", () => {
  const asset = (kind: PlanAsset["kind"]): PlanAsset => ({
    id: kind, name: kind, kind, value: 1_000_000, appreciation: 0, start: { type: "planStart" }, end: { type: "year", year: 2030 }, costBasis: 400_000,
  })
  const home = plan({ assets: [asset("home")] })
  assert.ok(Math.abs(row(home, 2030).saleTax - (600_000 - HOME_SALE_EXCLUSION.single) * 0.15) < 0.01)
  const couple = plan({ assets: [asset("home")], people: [...plan().people, { id: "p2", name: "Sam", birthYear: 1991, birthMonth: 1 }] })
  assert.ok(Math.abs(row(couple, 2030).saleTax - (600_000 - HOME_SALE_EXCLUSION.joint) * 0.15) < 0.01)
  const land = plan({ assets: [asset("other")] })
  assert.ok(Math.abs(row(land, 2030).saleTax - 600_000 * 0.15) < 0.01)
})

test("an inherited IRA is emptied evenly within 10 years, taxed as income; a Roth isn't taxed", () => {
  const d = inherit([part({ kind: "retirement", amount: 110_000 })])
  const ira = d.accounts.find((a) => a.name === "Inherited IRA")!
  assert.equal(ira.drainByYear, 2030 + INHERITED_IRA_YEARS)
  // 11 withdrawals (2030..2040) of 10k each, no growth.
  assert.equal(row(d, 2030).withdrawalsBy[ira.id], 10_000)
  assert.equal(row(d, 2030).withdrawalTax, 2_000)
  assert.equal(row(d, 2030).taxableIncome, 10_000)
  assert.ok(Math.abs(row(d, 2040).balances[ira.id]) < 1e-6)
  const roth = inherit([part({ kind: "retirement", amount: 110_000, roth: true })])
  assert.equal(row(roth, 2030).withdrawalTax, 0)
})

test("a mix of kinds with a state inheritance tax paid from cash flow", () => {
  const d = inherit(
    [part({ kind: "cash", amount: 50_000 }), part({ kind: "stocks", amount: 100_000 }), part({ kind: "realEstate", amount: 250_000 })],
    0.1,
  )
  assert.equal(d.expenses.find((e) => e.name === "State inheritance tax")?.amount, 40_000)
  assert.equal(d.milestones.filter((m) => m.name === "Inheritance").length, 1)
})

test("plans saved before deposits existed still load", () => {
  const { deposits: _d, ...old } = blankPlanDocument(NOW)
  assert.deepEqual(parsePlanDocument(old, blankPlanDocument(NOW))?.deposits, [])
})

test("state inheritance tax depends on where they lived and your relationship", () => {
  const cash = [part({ kind: "cash", amount: 200_000 })]
  const tax = (decedentState: string | null, relationship: Relationship) => inheritanceTaxFor({ parts: cash, decedentState, relationship })
  assert.equal(tax("PA", "child"), 9_000) // 4.5%
  assert.equal(tax("PA", "spouse"), 0)
  assert.equal(tax("NJ", "child"), 0) // Class A
  assert.equal(tax("NJ", "sibling"), 175_000 * 0.11) // first $25k exempt
  assert.equal(tax("NE", "child"), 1_000) // 1% above $100k
  assert.equal(tax("CA", "unrelated"), 0)
  assert.equal(tax(null, "unrelated"), 0)
})

test("the inheritance tax is charged the year you inherit", () => {
  const d = applyInheritance(
    plan(),
    { name: "Inheritance", when: { type: "year", year: 2030 }, parts: [part({ kind: "cash", amount: 200_000 })], decedentState: "PA", relationship: "child" },
    newId,
  )
  const taxLine = d.expenses.find((e) => e.name === "State inheritance tax")!
  assert.equal(row(d, 2030).expensesBy[taxLine.id], 9_000)
})

test("inherited property can be sold in a set year", () => {
  const d = inherit([part({ kind: "realEstate", amount: 400_000, sellYear: 2035 })])
  assert.deepEqual(d.assets[0].end, { type: "year", year: 2035 })
  assert.ok(row(d, 2034).assetValues[d.assets[0].id] > 0)
  assert.equal(row(d, 2036).assetValues[d.assets[0].id] ?? 0, 0)
})
