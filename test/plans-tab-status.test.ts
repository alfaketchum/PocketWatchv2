import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { HELOC_DEFAULTS } from "@/lib/plans/plan-debt-payments"
import { planTabStatus } from "@/lib/plans/plan-tab-status"
import type { PlanDebt, PlanDocument } from "@/lib/plans/plan-types"

const base = (): PlanDocument => blankPlanDocument(new Date(2026, 0, 15), 40)
const loan = (extra: Partial<PlanDebt>): PlanDebt => ({
  id: "d", name: "Loan", kind: "mortgage", balance: 300_000, rate: 0.06, monthlyPayment: 2_000, start: { type: "planStart" }, assetId: null, source: null, ...extra,
})

test("empty until something is entered, then filled", () => {
  const doc = base()
  const s = planTabStatus({ ...doc, incomes: [], expenses: [], assets: [], debts: [] })
  assert.equal(s.income.state, "empty")
  assert.equal(s.expenses.state, "empty")
  assert.equal(s.assets.state, "empty")
  assert.equal(s.assumptions.state, "filled")
  const filled = planTabStatus({ ...doc, debts: [loan({})] })
  assert.equal(filled.assets.state, "filled")
  assert.match(filled.assets.note, /1 debt/)
})

test("needs attention: a payment below the interest, or a HELOC with no home", () => {
  const low = planTabStatus({ ...base(), debts: [loan({ monthlyPayment: 1_000 })] })
  assert.equal(low.assets.state, "attention")
  assert.match(low.assets.note, /doesn't cover its interest/)
  assert.equal(planTabStatus({ ...base(), debts: [loan({ monthlyPayment: 1_000, extraMonthly: 600 })] }).assets.state, "filled", "extra counts")
  const heloc = planTabStatus({ ...base(), debts: [loan({ kind: "heloc", heloc: HELOC_DEFAULTS, monthlyPayment: 0 })] })
  assert.equal(heloc.assets.state, "attention")
  assert.match(heloc.assets.note, /isn't linked to a home/)
})
