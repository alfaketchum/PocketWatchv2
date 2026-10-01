import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { removalLabel, removedItems } from "@/lib/plans/plan-removals"

const base = () => blankPlanDocument(new Date(2026, 0, 15), 40)

test("names what an edit removed, by id, across lists", () => {
  const doc = base()
  const withDebt = { ...doc, debts: [{ id: "d", name: "Mortgage", kind: "mortgage" as const, balance: 1, rate: 0, monthlyPayment: 1, start: { type: "planStart" as const }, assetId: null, source: null }] }
  assert.deepEqual(removedItems(withDebt, doc), ["Mortgage"])
  assert.deepEqual(removedItems(doc, withDebt), [], "adding isn't removing")
  assert.deepEqual(removedItems(withDebt, { ...withDebt, debts: [{ ...withDebt.debts[0], name: "Renamed" }] }), [], "editing isn't removing")
  const noAccounts = { ...doc, accounts: [] }
  assert.equal(removedItems(doc, noAccounts).length, doc.accounts.length)
})

test("labels: one, two, or the first and a count", () => {
  assert.equal(removalLabel(["Mortgage"]), "Mortgage")
  assert.equal(removalLabel(["Mortgage", "Car loan"]), "Mortgage and Car loan")
  assert.equal(removalLabel(["Get married", "Jordan", "Salary", "Filing"]), "Get married and 3 more")
  assert.equal(removalLabel([]), "")
})
