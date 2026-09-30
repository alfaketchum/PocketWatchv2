import test from "node:test"
import assert from "node:assert/strict"
import { blankPlanDocument, PRIMARY_PERSON_ID } from "@/lib/plans/plan-constants"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { planSankey } from "@/lib/plans/plan-sankey"
import type { PlanDocument } from "@/lib/plans/plan-types"

const base = blankPlanDocument(new Date(2026, 0, 1), 40)
const plan: PlanDocument = {
  ...base,
  settings: { ...base.settings, cashBuffer: 0 },
  accounts: [
    { ...base.accounts[1], balance: 500_000 },
    { id: "k", name: "401k", taxTreatment: "traditional", balance: 0, costBasis: null, returnRate: 0.05, owner: null, source: null },
  ],
  incomes: [
    {
      id: "sal", name: "Salary", kind: "salary", amount: 120_000, growth: null, start: { type: "planStart" },
      end: { type: "age", personId: PRIMARY_PERSON_ID, age: 50 }, taxable: true, oneTime: false,
      contributions: [{ id: "c", accountId: "k", percent: 0.1, employerMatchPercent: 0.04, preTax: true }],
    },
  ],
  expenses: [
    { id: "rent", name: "Rent", category: null, amount: 30_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false },
    { id: "food", name: "Food", category: null, amount: 12_000, growth: null, start: { type: "planStart" }, end: { type: "planEnd" }, oneTime: false },
  ],
}

function conserved(s: ReturnType<typeof planSankey>) {
  s.nodes.forEach((_, i) => {
    const inflow = s.links.filter((l) => l.target === i).reduce((t, l) => t + l.value, 0)
    const outflow = s.links.filter((l) => l.source === i).reduce((t, l) => t + l.value, 0)
    if (inflow > 0 && outflow > 0) assert.ok(Math.abs(inflow - outflow) < 1, `${s.nodes[i].name}: in ${inflow} out ${outflow}`)
  })
}

test("working year: salary flows through cash flow into taxes, spending lines and contributions", () => {
  const rows = simulatePlan(plan).rows
  const s = planSankey(plan, rows[0], 40)
  conserved(s)
  const names = s.nodes.map((n) => n.name)
  for (const n of ["Salary", "Cash flow", "Taxes", "Spending", "Rent", "Food", "Contributions", "401k", "Brokerage"]) assert.ok(names.includes(n), n)
  assert.equal(s.total, 120_000)
})

test("retired year: withdrawals are the source", () => {
  const rows = simulatePlan(plan).rows
  const s = planSankey(plan, rows[15], 55)
  conserved(s)
  const sources = s.links.filter((l) => l.target === 0).map((l) => s.nodes[l.source].name)
  assert.ok(sources.some((n) => n.startsWith("From ")), sources.join(","))
  assert.ok(!sources.includes("Salary"))
})
