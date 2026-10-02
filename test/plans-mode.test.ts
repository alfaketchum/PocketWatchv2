import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { advancedSettingsInUse, BASIC_CHART_VIEWS, BASIC_LEDGER_VIEW, BASIC_MILESTONE_TEMPLATES, BASIC_TABS } from "@/lib/plans/plan-mode"
import { MILESTONE_TEMPLATES } from "@/lib/plans/milestone-templates"
import { LEDGER_VIEWS } from "@/components/plans/results/ledger-columns"
import type { PlanDocument } from "@/lib/plans/plan-types"

const base = blankPlanDocument(new Date(2026, 0, 1), 40)
const keys = (doc: PlanDocument) => advancedSettingsInUse(doc).map((s) => s.key)
const withSettings = (change: Partial<PlanDocument["settings"]>): PlanDocument => ({ ...base, settings: { ...base.settings, ...change } })

test("a blank plan uses nothing Basic hides", () => {
  assert.deepEqual(advancedSettingsInUse(base), [])
})

test("each advanced setting is reported once set", () => {
  const [cash, brokerage] = base.accounts
  const cases: [string, PlanDocument][] = [
    ["flatTax", withSettings({ taxMode: "flat" })],
    ["marketInflation", withSettings({ inflationMode: "marketPath" })],
    ["ssCut", withSettings({ ssCut: { share: 0.8, fromYear: 2034 } })],
    ["realReturns", withSettings({ returnBasis: "real" })],
    ["patterns", withSettings({ spendingProfile: "typical" })],
    ["spendingRule", withSettings({ spendingRule: { kind: "guardrails", band: 0.2, step: 0.1 } })],
    ["cashBuffer", withSettings({ cashBuffer: 5_000 })],
    ["trading", { ...base, accounts: [cash, { ...brokerage, realizedShare: 0.2 }] }],
    ["surplusOrder", { ...base, cashFlow: { ...base.cashFlow, surplusOrder: [{ accountId: brokerage.id, annualCap: null }] } }],
    ["withdrawalOrder", { ...base, cashFlow: { ...base.cashFlow, withdrawalOrder: [brokerage.id, cash.id] } }],
    ["earlyPenalty", { ...base, cashFlow: { ...base.cashFlow, avoidEarlyPenalty: false } }],
    ["adjustments", { ...base, adjustments: [{ id: "a", kind: "spending", timing: { type: "year", year: 2030 }, percent: -0.1 }] }],
  ]
  for (const [key, doc] of cases) assert.deepEqual(keys(doc), [key], key)
})

test("what a milestone template made, and orders matching the default, aren't flagged", () => {
  const [cash, brokerage] = base.accounts
  const doc: PlanDocument = {
    ...base,
    adjustments: [{ id: "a", kind: "filingStatus", timing: { type: "year", year: 2030 }, status: "joint", origin: "ms-married" }],
    cashFlow: { ...base.cashFlow, withdrawalOrder: [cash.id, brokerage.id] },
  }
  assert.deepEqual(advancedSettingsInUse(doc), [])
})

test("Basic's allow-lists name real tabs, views and templates", () => {
  const tabs = ["assumptions", "milestones", "accounts", "income", "expenses", "assets", "cashflow", "overview"]
  for (const t of BASIC_TABS) assert.ok(tabs.includes(t), t)
  assert.ok(!BASIC_TABS.includes("cashflow"))
  for (const v of BASIC_CHART_VIEWS) assert.ok(["networth", "income", "expenses"].includes(v), v)
  assert.ok(BASIC_LEDGER_VIEW in LEDGER_VIEWS)
  const templates = MILESTONE_TEMPLATES.map((t) => t.key as string)
  for (const t of BASIC_MILESTONE_TEMPLATES) assert.ok(templates.includes(t), t)
})
