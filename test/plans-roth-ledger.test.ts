import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { initialRothLedgers, rothTranches, withInflows, withWithdrawals } from "@/lib/plans/engine/engine-roth-ledger"
import type { PlanDocument } from "@/lib/plans/plan-types"

function doc(age: number): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), age)
  return { ...base, accounts: [{ id: "roth", name: "Roth", taxTreatment: "roth", balance: 10_000, costBasis: null, returnRate: 0, owner: null, source: null }] }
}

test("opening balance counts as contributions; conversions are lots by year", () => {
  const l = withInflows(initialRothLedgers(doc(50)), { roth: 1_000 }, { roth: 20_000 }, 2026)
  assert.deepEqual(l.roth, { contributions: 11_000, lots: [{ year: 2026, amount: 20_000 }] })
})

test("withdrawals take contributions first, then lots oldest first", () => {
  const l = withInflows(withInflows(initialRothLedgers(doc(50)), {}, { roth: 5_000 }, 2026), {}, { roth: 7_000 }, 2027)
  assert.deepEqual(withWithdrawals(l, { roth: 13_000 }).roth, { contributions: 0, lots: [{ year: 2026, amount: 2_000 }, { year: 2027, amount: 7_000 }] })
})

test("tranches: young lots are penalized before 59½; seasoned lots and 59½ are free", () => {
  const d = doc(50)
  const l = withInflows(withInflows(initialRothLedgers(d), {}, { roth: 5_000 }, 2026), {}, { roth: 7_000 }, 2029)
  assert.deepEqual(rothTranches(l, d, 2030), { roth: { free: 10_000, penalized: 12_000 } })
  assert.deepEqual(rothTranches(l, d, 2031), { roth: { free: 15_000, penalized: 7_000 } })
  assert.deepEqual(rothTranches(l, doc(60), 2030), {})
})
