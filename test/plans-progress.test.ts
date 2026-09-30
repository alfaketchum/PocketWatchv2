import test from "node:test"
import assert from "node:assert/strict"
import { monthlyActual, progressStatus, valueAt } from "@/lib/plans/plan-progress"

test("valueAt interpolates inside the path and is null outside", () => {
  const path = [{ x: 2026, value: 100 }, { x: 2027, value: 200 }]
  assert.equal(valueAt(path, 2026.5), 150)
  assert.equal(valueAt(path, 2025), null)
  assert.equal(valueAt(path, 2028), null)
})

test("monthlyActual keeps the last point of each month", () => {
  const points = monthlyActual([
    { date: "2026-01-05", total: 1 },
    { date: "2026-01-31", total: 2 },
    { date: "2026-02-10", total: 3 },
  ])
  assert.deepEqual(points.map((p) => p.value), [2, 3])
})

test("progressStatus: ahead of plan is positive; before the plan starts is null", () => {
  const path = [{ x: 2026, value: 100 }, { x: 2027, value: 200 }]
  const status = progressStatus(path, [{ x: 2026.5, value: 170 }])
  assert.equal(status?.difference, 20)
  assert.equal(progressStatus(path, [{ x: 2025.5, value: 170 }]), null)
})

import { readFileSync } from "node:fs"
import { parseDataset } from "@/lib/fire/swr-simulation"
import type { ShillerDataset } from "@/lib/fire/fire-types"
import { backtestInput, planSuccessRate } from "@/lib/plans/plan-backtest"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument, PRIMARY_PERSON_ID } from "@/lib/plans/plan-constants"
import type { PlanDocument } from "@/lib/plans/plan-types"

function retiredPlan(spend: number): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 1), 60)
  return {
    ...base,
    settings: { ...base.settings, inflation: 0, incomeTaxRate: 0, capitalGainsRate: 0, cashBuffer: 0, endAge: 90 },
    accounts: [{ ...base.accounts[1], balance: 1_000_000, returnRate: 0.05 }],
    expenses: [
      { id: "e", name: "Living", category: null, amount: spend, growth: 0, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false },
    ],
    milestones: [{ ...base.milestones[0], timing: { type: "age", personId: PRIMARY_PERSON_ID, age: 60 } }],
  }
}

test("backtestInput turns retirement spending into monthly draws on the retirement portfolio", () => {
  const doc = retiredPlan(40_000)
  const input = backtestInput(doc, simulatePlan(doc))
  assert.ok(input)
  assert.equal(input.portfolio, 1_000_000)
  assert.equal(input.horizonMonths, 30 * 12)
  assert.ok(Math.abs(input.flows[0].amount - -40_000 / 12 / 1_000_000) < 1e-12)
})

test("historical success: 3% spending survives far more often than 8%", () => {
  const h = parseDataset(JSON.parse(readFileSync("src/lib/fire/data/shiller-monthly.json", "utf8")) as ShillerDataset)
  const rate = (spend: number) => {
    const doc = retiredPlan(spend)
    return planSuccessRate(h, backtestInput(doc, simulatePlan(doc))!, 0.75) ?? 0
  }
  const safe = rate(30_000)
  const risky = rate(80_000)
  assert.ok(safe > 0.95, `3% success ${safe}`)
  assert.ok(risky < 0.5, `8% success ${risky}`)
})
