import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { monthlyPayment } from "@/lib/plans/plan-debt-payments"
import { applyDispose, keepAsset, type DisposeChoice } from "@/lib/plans/plan-dispose"
import { removeMilestoneWithItems } from "@/lib/plans/plan-milestone-uses"
import type { PlanDocument } from "@/lib/plans/plan-types"

let n = 0
const newId = (p: string) => `${p}-${++n}`
const close = (a: number, b: number, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`)

/** A $500k home bought long ago ($200k basis), a $200k mortgage on it; no inflation, no taxes, 2026 start. */
function plan(): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 50)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "flat", inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 80 },
    accounts: [{ ...base.accounts[0], balance: 100_000, returnRate: 0 }],
    assets: [{ id: "h", name: "Home", kind: "home", value: 500_000, appreciation: 0, start: { type: "planStart" }, end: { type: "planEnd" }, costBasis: 200_000, primaryResidence: true }],
    debts: [{ id: "m", name: "Mortgage", kind: "mortgage", balance: 200_000, rate: 0.05, monthlyPayment: monthlyPayment(200_000, 0.05, 360), start: { type: "planStart" }, assetId: "h", source: null }],
  }
}
const when = { type: "year" as const, year: 2030 }
const choice = (mode: DisposeChoice["mode"], to: "buy" | "rent" = "buy"): DisposeChoice => ({ mode, when, downsize: { to, price: 300_000, payWith: "cash", monthlyRent: 2_000 } })
const rowIn = (doc: PlanDocument, year: number) => simulatePlan(doc).rows.find((r) => r.year === year)!

test("sell: its value comes back, less what's still owed on its loan", () => {
  const doc = applyDispose(plan(), "h", choice("sell"), newId)
  const before = simulatePlan(plan()).rows.find((r) => r.year === 2029)!
  const r = rowIn(doc, 2030)
  close(r.assetSales, 500_000 - before.debtBalances.m)
  assert.equal(r.debtBalances.m, 0)
})

test("downsize to a smaller home: one event that sells, buys and can be undone", () => {
  const doc = applyDispose(plan(), "h", choice("downsize"), newId)
  const ms = doc.milestones.find((m) => m.name === "Downsize Home")!
  const small = doc.assets.find((a) => a.name === "Smaller home")!
  assert.deepEqual(small.start, { type: "milestone", milestoneId: ms.id })
  assert.equal(small.origin, ms.id)
  const r = rowIn(doc, 2030)
  assert.ok(r.assetSales > 0)
  close(r.assetPurchases, 300_000)
  const moved = { ...doc, milestones: doc.milestones.map((m) => (m.id === ms.id ? { ...m, timing: { type: "year" as const, year: 2033 } } : m)) }
  close(rowIn(moved, 2033).assetPurchases, 300_000)
  const undone = removeMilestoneWithItems(doc, ms.id)
  assert.equal(undone.assets.some((a) => a.name === "Smaller home"), false)
})

test("downsize to renting adds rent on Housing from the sale on; keep undoes a sale", () => {
  const doc = applyDispose(plan(), "h", choice("downsize", "rent"), newId)
  const rent = doc.expenses.find((e) => e.name === "Rent")!
  assert.equal(rent.category, "Housing")
  assert.equal(rent.amount, 24_000)
  const kept = keepAsset(applyDispose(plan(), "h", choice("sell"), newId), "h")
  assert.deepEqual(kept.assets[0].end, { type: "planEnd" })
})
