import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import {
  applyBreak,
  applyCareer,
  applyChild,
  applyCustom,
  applyHome,
  applyVehicle,
  applyInheritance,
  applyMarried,
  applyDivorce,
  applyMove,
  applyWindfall,
  type InheritedPart,
} from "@/lib/plans/milestone-templates"
import { removeAsset, removeChild } from "@/lib/plans/plan-edits"
import { detachMilestone, milestoneCreations, removeMilestoneWithItems } from "@/lib/plans/plan-milestone-uses"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { expandPlan } from "@/lib/plans/plan-expand"
import type { PlanDocument } from "@/lib/plans/plan-types"

let n = 0
const newId = (p: string) => `${p}-${++n}`
const when = { type: "year" as const, year: 2030 }

/** A plan with a salary, an expense and a taxable account, like a real one. */
function base(): PlanDocument {
  const doc = blankPlanDocument(new Date(2026, 0, 15), 35)
  return {
    ...doc,
    incomes: [
      {
        id: "sal", name: "Salary", kind: "salary", amount: 100_000, growth: null, start: { type: "planStart" },
        end: { type: "milestone", milestoneId: doc.milestones[0].id }, taxable: true, oneTime: false, contributions: [],
      },
    ],
    expenses: [{ id: "live", name: "Living", category: null, amount: 50_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
  }
}

/** The milestone a template just added (the one the base plan didn't have). */
function added(before: PlanDocument, after: PlanDocument): string {
  const ids = new Set(before.milestones.map((m) => m.id))
  const fresh = after.milestones.filter((m) => !ids.has(m.id) && !m.origin)
  assert.equal(fresh.length, 1, "expected exactly one new top-level milestone")
  return fresh[0].id
}

const part = (p: Partial<InheritedPart>): InheritedPart => ({ kind: "cash", amount: 0, label: "", accountId: null, roth: false, ...p })

const TEMPLATES: [string, (d: PlanDocument) => PlanDocument][] = [
  ["Get married (partner, salary, tax change, wedding)", (d) =>
    applyMarried(d, { when, partner: { name: "Sam", birthYear: 1992 }, partnerIncome: 60_000, incomeTaxRate: 0.15, capitalGainsRate: 0.15, weddingCost: 30_000 }, newId)],
  ["Career change", (d) => applyCareer(d, { incomeId: "sal", when, name: "New job", amount: 150_000 }, newId)],
  ["Career break", (d) => applyBreak(d, { incomeId: "sal", startYear: 2030, years: 2 }, newId)],
  ["Move", (d) => applyMove(d, { name: "Move", when, percent: -0.1 }, newId)],
  ["Windfall", (d) => applyWindfall(d, { name: "Bonus", when, amount: 50_000, taxable: true }, newId)],
  ["Inheritance (every kind + state tax)", (d) =>
    applyInheritance(d, {
      name: "Inheritance",
      when,
      stateTaxRate: 0.05,
      parts: [
        part({ kind: "cash", amount: 50_000 }),
        part({ kind: "stocks", amount: 200_000 }),
        part({ kind: "stocks", amount: 30_000, accountId: "acct-brokerage" }),
        part({ kind: "realEstate", amount: 400_000 }),
        part({ kind: "retirement", amount: 150_000 }),
        part({ kind: "retirement", amount: 80_000, roth: true }),
      ],
    }, newId)],
  ["Divorce (income ends, split, costs, support)", (d) =>
    applyDivorce(d, { when, endIncomeIds: ["sal"], exShare: 0.5, legalCost: 20_000, supportPerYear: 12_000, supportYears: 5, spendingChange: -0.2, incomeTaxRate: 0.2, capitalGainsRate: 0.15 }, newId)],
  ["Custom", (d) => applyCustom(d, { name: "Sabbatical idea", when }, newId)],
]

for (const [label, apply] of TEMPLATES) {
  test(`${label}: adding then removing it (with its items) restores the plan exactly`, () => {
    const before = base()
    const after = apply(before)
    assert.ok(planDocumentSchema.safeParse(after).success, "the added plan is valid")
    assert.notDeepEqual(after, before)
    const id = added(before, after)
    const removed = removeMilestoneWithItems(after, id)
    assert.deepEqual(removed, before)
    assert.ok(planDocumentSchema.safeParse(removed).success)
  })
}

test("the delete prompt can list what a template created", () => {
  const before = base()
  const after = applyMarried(before, { when, partner: { name: "Sam", birthYear: 1992 }, partnerIncome: 60_000, incomeTaxRate: 0.15, capitalGainsRate: 0.15, weddingCost: 30_000 }, newId)
  assert.deepEqual(milestoneCreations(after, added(before, after)).sort(), ["Filing status changes", "Sam (person)", "Sam's salary (income)", "Tax rates change", "Wedding (expense)"].sort())
})

test("career change removed: the original salary runs to its original end again", () => {
  const before = base()
  const after = applyCareer(before, { incomeId: "sal", when, name: "New job", amount: 150_000 }, newId)
  const removed = removeMilestoneWithItems(after, added(before, after))
  const year = (d: PlanDocument, y: number) => simulatePlan(d).rows.find((r) => r.year === y)!.income
  assert.equal(year(removed, 2035), year(before, 2035))
  assert.notEqual(year(after, 2035), year(before, 2035))
})

test("keeping the items instead pins them to the milestone's year", () => {
  const before = base()
  const after = applyWindfall(before, { name: "Bonus", when, amount: 50_000, taxable: true }, newId)
  const kept = detachMilestone(after, added(before, after))
  const bonus = kept.incomes.find((i) => i.name === "Bonus")!
  assert.deepEqual(bonus.start, { type: "year", year: 2030 })
  assert.equal(kept.milestones.length, before.milestones.length)
})

test("Buy a home / a vehicle: the loan comes from the asset, so deleting the asset removes both", () => {
  const before = base()
  const input = { name: "House", when, price: 500_000, payWith: "loan" as const, downPayment: 100_000, rate: 0.06, termYears: 30, appreciation: 0.03 }
  for (const apply of [applyHome, applyVehicle]) {
    const after = apply(before, input, newId)
    assert.equal(after.debts.length, 0)
    assert.equal(expandPlan(after).debts.filter((d) => d.assetId === after.assets[0].id).length, 1)
    assert.ok(planDocumentSchema.safeParse(after).success)
    assert.deepEqual(removeAsset(after, after.assets[0].id), before)
  }
})

test("Have a child: deleting the child restores the plan", () => {
  const before = base()
  const after = applyChild(before, "Maya", 2029, newId)
  assert.deepEqual(removeChild(after, after.children[0].id), before)
})

test("divorce: the ex's share of each account moves out untaxed; support runs its years; you file single", () => {
  const doc = base()
  const plain = simulatePlan(doc).rows
  const divorced = applyDivorce(doc, { when, endIncomeIds: [], exShare: 0.5, legalCost: 0, supportPerYear: 12_000, supportYears: 5, spendingChange: 0, incomeTaxRate: 0.2, capitalGainsRate: 0.15 }, newId)
  const rows = simulatePlan(divorced).rows
  const i = 2030 - doc.settings.startYear
  assert.ok(rows[i].splitOut > 0)
  assert.equal(rows[i - 1].splitOut, 0)
  assert.equal(rows[i].withdrawalTax, plain[i].withdrawalTax, "the split itself isn't taxed")
  const support = divorced.expenses.find((e) => e.name.startsWith("Alimony"))!
  const paid = rows.filter((r) => (r.expensesBy[support.id] ?? 0) > 0).length
  assert.equal(paid, 5)
  assert.equal((divorced.adjustments ?? []).some((a) => a.kind === "filingStatus" && a.status === "single"), true)
})
