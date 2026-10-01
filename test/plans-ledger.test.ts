import test from "node:test"
import assert from "node:assert/strict"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { columnsFor, LEDGER_COLUMNS, LEDGER_VIEWS, lifetimeValue, startBalances } from "@/components/plans/results/ledger-columns"
import { ledgerCsv } from "@/components/plans/results/ledger-csv"

const base = blankPlanDocument(new Date(2026, 0, 15), 40)
const doc = {
  ...base,
  settings: { ...base.settings, inflation: 0, endAge: 44 },
  accounts: [{ ...base.accounts[0], balance: 100_000, returnRate: 0.05 }],
  expenses: [{ id: "e", name: "Living", category: null, amount: 10_000, growth: 0, start: { type: "planStart" as const }, end: { type: "planEnd" as const }, oneTime: false }],
}
const rows = simulatePlan(doc).rows
const starts = startBalances(doc, rows)
const ctx = (i: number) => ({ doc, startBalance: starts[i] })
const col = (id: string) => LEDGER_COLUMNS.find((c) => c.id === id)!

test("every view lists known columns; Everything lists them all", () => {
  for (const v of Object.values(LEDGER_VIEWS)) for (const id of v.columns) assert.ok(col(id), id)
  assert.equal(columnsFor("all").length, LEDGER_COLUMNS.length)
})

test("lifetime row: flows add up, balances show the last year, rates are blank", () => {
  assert.equal(lifetimeValue(col("spending"), rows, ctx), -40_000)
  assert.equal(lifetimeValue(col("netWorth"), rows, ctx), rows.at(-1)!.netWorth)
  assert.equal(lifetimeValue(col("returnRate"), rows, ctx), null)
  assert.ok(Math.abs(col("returnRate").value(rows[0], ctx(0))! - 0.05) < 1e-9, "growth ÷ start-of-year balance")
})

test("CSV has a header and one line per year with every column", () => {
  const lines = ledgerCsv(doc, rows).split("\n")
  assert.equal(lines.length, rows.length + 1)
  assert.equal(lines[0].split(",").length, LEDGER_COLUMNS.length + 3)
})
