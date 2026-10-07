import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, ROTH_OPTIMIZER_ORIGIN } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"
import { rothStrategies, strategyCandidate, strategyWindows } from "@/lib/plans/roth/roth-candidates"
import { applyCandidate, optimizeRoth } from "@/lib/plans/roth/roth-optimizer"
import type { PlanAccount, PlanDocument, TaxTreatment } from "@/lib/plans/plan-types"

const account = (id: string, taxTreatment: TaxTreatment, balance: number): PlanAccount => ({
  id, name: id, taxTreatment, balance, costBasis: null, returnRate: 0.05, owner: null, source: null,
})

/** 60, retired, a big IRA and modest spending: years of low brackets before required withdrawals. */
function plan(accounts: PlanAccount[]): PlanDocument {
  const base = blankPlanDocument(new Date(2026, 0, 15), 60)
  return {
    ...base,
    settings: { ...base.settings, taxMode: "brackets", state: null, inflation: 0.02, cashBuffer: 0, protectBuffer: false, endAge: 90 },
    accounts,
    incomes: [],
    expenses: [{ id: "e", name: "Living", category: null, amount: 40_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false }],
    cashFlow: { surplusOrder: [], withdrawalOrder: [] },
    milestones: base.milestones.map((m) => ({ ...m, timing: { type: "planStart" as const } })),
  }
}

const HEAVY = [account("cash", "cash", 400_000), account("ira", "traditional", 2_000_000), account("roth", "roth", 0)]

test("windows resolve to distinct, non-empty year ranges; strategies cover every mode", () => {
  const doc = plan(HEAVY)
  const windows = strategyWindows(doc)
  assert.ok(windows.length >= 2)
  const modes = new Set(rothStrategies(doc).map((s) => s.mode.mode))
  assert.deepEqual([...modes].sort(), ["bracket", "convertAll", "fixed"])
})

test("on a traditional-heavy plan the best strategy beats converting nothing, and applying it validates", () => {
  const doc = plan(HEAVY)
  const result = optimizeRoth(doc)
  assert.ok(result.top.length > 0)
  assert.ok(result.top[0].gain > 0, `gain ${result.top[0].gain}`)
  assert.ok(result.top[0].outcome.lifetimeRequired < result.baseline.lifetimeRequired)
  const applied = applyCandidate(doc, result.top[0].candidate)
  assert.equal(planDocumentSchema.safeParse(applied).success, true)
  assert.ok(applied.conversions?.every((c) => c.origin === ROTH_OPTIMIZER_ORIGIN))
  const keys = result.top.map((r) => `${Math.round(r.outcome.afterTaxNetWorth)}`)
  assert.equal(new Set(keys).size, keys.length)
})

test("without a Roth account a candidate opens one for the owner", () => {
  const doc = plan(HEAVY.filter((a) => a.taxTreatment !== "roth"))
  const c = strategyCandidate(doc, rothStrategies(doc)[0])
  assert.ok(c)
  assert.equal(c.newAccounts.length, 1)
  assert.equal(c.newAccounts[0].taxTreatment, "roth")
  assert.equal(c.rules[0].destAccountId, c.newAccounts[0].id)
  assert.equal(planDocumentSchema.safeParse(applyCandidate(doc, c)).success, true)
})

test("nothing to convert: no candidates", () => {
  const doc = plan([account("cash", "cash", 400_000)])
  assert.equal(strategyCandidate(doc, rothStrategies(doc)[0]), null)
  assert.equal(optimizeRoth(doc).top.length, 0)
})
