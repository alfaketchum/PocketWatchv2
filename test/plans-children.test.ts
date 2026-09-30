import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { childIds, childMilestones, newChild } from "@/lib/plans/plan-children"
import { allMilestones } from "@/lib/plans/plan-milestones"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { planDocumentSchema, parsePlanDocument } from "@/lib/plans/plan-schema"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanAccount, PlanChild, PlanDocument } from "@/lib/plans/plan-types"

const NOW = new Date(2026, 0, 15)

function acct(id: string, taxTreatment: PlanAccount["taxTreatment"], balance: number): PlanAccount {
  return { id, name: id, taxTreatment, balance, costBasis: null, returnRate: 0, owner: null, source: null }
}

/** No inflation or taxes; parent aged 35 in 2026, plan to 70. */
function plan(child: PlanChild, extra: Partial<PlanDocument> = {}): PlanDocument {
  const base = blankPlanDocument(NOW, 35)
  return {
    ...base,
    settings: { ...base.settings, inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 70 },
    accounts: [acct("brk", "taxable", 2_000_000), acct("sam529", "education", 0)],
    children: [child],
    ...extra,
  }
}

const sam = (patch: Partial<PlanChild> = {}): PlanChild => ({ ...newChild("sam", "Sam", 2028), ...patch })
const yearRow = (d: PlanDocument, year: number) => simulatePlan(d).rows.find((r) => r.year === year)!

test("a child adds milestones others can point at", () => {
  const child = sam({ college: { ...newChild("x", "x", 0).college, enabled: true }, support: { enabled: true, annualAmount: 10_000, years: 2 } })
  const d = plan(child)
  assert.deepEqual(
    childMilestones(d).map((m) => [m.name, (m.timing as { year: number }).year]),
    [["Sam born", 2028], ["Sam starts college", 2046], ["Sam graduates", 2050], ["Sam's support ends", 2052]],
  )
  assert.equal(resolveTiming({ type: "milestone", milestoneId: childIds("sam").college }, timingContext(d)), 20)
})

test("raising costs run from birth until 18 and are an expense", () => {
  const d = plan(sam())
  assert.equal(yearRow(d, 2027).expensesBy[childIds("sam").raising], undefined)
  assert.equal(yearRow(d, 2028).expensesBy[childIds("sam").raising], 18_000)
  assert.equal(yearRow(d, 2045).expensesBy[childIds("sam").raising], 18_000)
  assert.equal(yearRow(d, 2046).expensesBy[childIds("sam").raising], undefined)
})

test("college costs grow faster than inflation and last the chosen years", () => {
  const child = sam({ raising: { enabled: false, annualCost: 0, untilAge: 18 }, college: { ...newChild("x", "x", 0).college, enabled: true, annualCost: 30_000, growth: 0.05 } })
  const d = plan(child)
  const cost = (year: number) => yearRow(d, year).expensesBy[childIds("sam").collegeCost]
  assert.ok(Math.abs(cost(2046) - 30_000 * Math.pow(1.05, 20)) < 0.01)
  assert.equal(cost(2050), undefined)
})

test("529: contributions until college, then college is paid from it first, tax-free", () => {
  const child = sam({
    raising: { enabled: false, annualCost: 0, untilAge: 18 },
    college: { ...newChild("x", "x", 0).college, enabled: true, annualCost: 30_000, growth: 0 },
    plan529: { enabled: true, accountId: "sam529", annualContribution: 5_000 },
  })
  const d = plan(child)
  // 2028..2045: 18 years × 5k = 90k, no growth.
  assert.equal(yearRow(d, 2045).balances.sam529, 90_000)
  assert.equal(yearRow(d, 2045).contributionsBy.sam529, 5_000)
  // College years draw from the 529 before anything else.
  const y1 = yearRow(d, 2046)
  assert.equal(y1.withdrawalsBy.sam529, 30_000)
  assert.equal(y1.balances.sam529, 60_000)
  assert.equal(y1.withdrawalTax, 0)
  // Year 4: only 0 left after three years → brokerage pays.
  const y4 = yearRow(d, 2049)
  assert.equal(y4.withdrawalsBy.sam529, undefined)
  assert.equal(y4.withdrawalsBy.brk, 30_000)
})

test("529 money is never used for other shortfalls", () => {
  const d = plan(sam({ raising: { enabled: false, annualCost: 0, untilAge: 18 } }), {
    accounts: [acct("brk", "taxable", 0), { ...acct("sam529", "education", 50_000) }],
    expenses: [{ id: "e", name: "Living", category: null, amount: 10_000, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  })
  const first = simulatePlan(d).rows[0]
  assert.equal(first.balances.sam529, 50_000)
  assert.equal(first.shortfall, 10_000)
})

test("support after college starts at graduation for the chosen years", () => {
  const child = sam({
    raising: { enabled: false, annualCost: 0, untilAge: 18 },
    college: { ...newChild("x", "x", 0).college, enabled: true, growth: 0 },
    support: { enabled: true, annualAmount: 12_000, years: 3 },
  })
  const d = plan(child)
  const support = (year: number) => yearRow(d, year).expensesBy[childIds("sam").supportCost]
  assert.equal(support(2049), undefined)
  assert.equal(support(2050), 12_000)
  assert.equal(support(2052), 12_000)
  assert.equal(support(2053), undefined)
})

test("buying a house later becomes a milestone", () => {
  const d = plan(sam(), {
    assets: [{ id: "h", name: "the house", kind: "home", value: 500_000, appreciation: 0, start: { type: "year", year: 2030 }, end: { type: "planEnd" } }],
  })
  const buy = allMilestones(d).find((m) => m.name === "Buy the house")
  assert.equal(buy?.icon, "home")
  assert.ok(simulatePlan(d).rows.find((r) => r.year === 2030)?.milestones.includes("Buy the house"))
})

test("children validate, and plans saved before children existed still load", () => {
  const d = plan(sam())
  assert.ok(planDocumentSchema.safeParse(d).success)
  const { children: _c, ...old } = blankPlanDocument(NOW)
  assert.deepEqual(parsePlanDocument(old, blankPlanDocument(NOW))?.children, [])
})
