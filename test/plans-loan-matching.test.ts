import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { expandPlan } from "@/lib/plans/plan-expand"
import { applyLoanAsAsset, applyLoanLink, ignoreLoan, loanSuggestions } from "@/lib/plans/plan-loan-matching"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import type { PlanAsset, PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

let n = 0
const newId = (p: string) => `${p}-${++n}`

function plan(assets: PlanAsset[] = [], debts: PlanDebt[] = []): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 40)
  return { ...base, settings: { ...base.settings, taxMode: "flat", inflation: 0.03, cashBuffer: 0 }, assets, debts }
}
const loan = (id: string, kind: PlanDebt["kind"], balance = 36_000): PlanDebt => ({
  id: `debt-${id}`, name: `${kind} loan ${id}`, kind, balance, rate: 0.069, monthlyPayment: 700,
  start: { type: "planStart" }, assetId: null, source: { kind: "finance-account", refId: id },
})
const asset = (id: string, kind: PlanAsset["kind"], year: number | null): PlanAsset => ({
  id, name: id, kind, value: 40_000, appreciation: -0.15, start: year ? { type: "year", year } : { type: "planStart" }, end: { type: "planEnd" },
  financing: { mode: "undecided", downShare: 0.1, rate: 0.075, termYears: 5 },
})

test("a new auto loan matches the soonest planned car; a mortgage the planned home", () => {
  const d = plan([asset("later-car", "vehicle", 2031), asset("car", "vehicle", 2027), asset("house", "home", 2029)])
  const s = loanSuggestions(d, [loan("a1", "auto"), loan("m1", "mortgage", 400_000)])
  assert.deepEqual(s.map((x) => [x.type, x.type === "link" ? x.asset.id : null]), [["link", "car"], ["link", "house"]])
})

test("two loans don't claim the same car; a loan with nothing to pay for suggests adding the asset", () => {
  const s = loanSuggestions(plan([asset("car", "vehicle", 2027)]), [loan("a1", "auto"), loan("a2", "auto", 27_000)])
  assert.equal(s[0].type, "link")
  assert.equal(s[1].type, "addAsset")
  assert.equal(s[1].type === "addAsset" ? s[1].estimatedValue : 0, 30_000)
})

test("loans already in the plan, ignored, or not for an asset aren't suggested", () => {
  const inPlan = plan([asset("car", "vehicle", 2027)], [{ ...loan("a1", "auto"), assetId: "car" }])
  assert.equal(loanSuggestions(inPlan, [loan("a1", "auto")]).length, 0)
  const ignored = ignoreLoan(plan(), loan("a1", "auto"))
  assert.deepEqual(ignored.ignoredSources, ["a1"])
  assert.equal(loanSuggestions(ignored, [loan("a1", "auto")]).length, 0)
  assert.equal(loanSuggestions(plan(), [loan("s1", "student"), loan("c1", "credit")]).length, 0)
})

test("using the real loan: the car is owned now, paid by that loan instead of the planned one", () => {
  const d = applyLoanLink(plan([asset("car", "vehicle", 2028)]), loan("a1", "auto"), "car")
  assert.deepEqual(d.assets[0].start, { type: "planStart" })
  assert.equal(d.debts[0].assetId, "car")
  const debts = expandPlan(d).debts
  assert.deepEqual(debts.map((x) => x.id), ["debt-a1"])
  assert.equal(simulatePlan(d).rows.find((r) => r.year === 2028)!.assetPurchases, 0)
  assert.ok(planDocumentSchema.safeParse(d).success)
})

test("adding the asset a loan is for: owned now at the given value, typical costs, loan linked", () => {
  const d = applyLoanAsAsset(plan(), loan("m1", "mortgage", 400_000), "home", 550_000, newId)
  assert.equal(d.assets[0].kind, "home")
  assert.equal(d.assets[0].value, 550_000)
  assert.ok((d.assets[0].runningCosts ?? []).length > 0)
  assert.equal(d.debts[0].assetId, d.assets[0].id)
  assert.ok(planDocumentSchema.safeParse(d).success)
})
