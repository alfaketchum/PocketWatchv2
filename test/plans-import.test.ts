import test from "node:test"
import assert from "node:assert/strict"
import {
  accountsFromRows,
  debtsFromRows,
  expensesFromCategories,
  spendingOptions,
  taxTreatmentFor,
  type ImportAccountRow,
} from "@/lib/plans/import/import-mapping"
import { applySourceBalances } from "@/lib/plans/plan-refresh"
import { blankPlanDocument } from "@/lib/plans/plan-constants"
import { planDocumentSchema } from "@/lib/plans/plan-schema"

function row(id: string, type: string, subtype: string | null, balance: number): ImportAccountRow {
  return { id, name: id, institution: "Bank", type, subtype, currentBalance: balance, apy: null }
}

test("taxTreatmentFor maps account subtypes to tax buckets", () => {
  assert.equal(taxTreatmentFor("checking", "checking"), "cash")
  assert.equal(taxTreatmentFor("savings", "savings"), "cash")
  assert.equal(taxTreatmentFor("investment", "401k"), "traditional")
  assert.equal(taxTreatmentFor("investment", "sep_ira"), "traditional")
  assert.equal(taxTreatmentFor("investment", "roth_ira"), "roth")
  assert.equal(taxTreatmentFor("investment", "roth 401k"), "roth")
  assert.equal(taxTreatmentFor("investment", "hsa"), "hsa")
  assert.equal(taxTreatmentFor("investment", "529"), "education")
  assert.equal(taxTreatmentFor("investment", "brokerage"), "taxable")
  assert.equal(taxTreatmentFor("investment", "stock plan"), "taxable")
  assert.equal(taxTreatmentFor("credit", "credit card"), null)
})

test("accountsFromRows skips debts and empty accounts and keeps the link back", () => {
  const accounts = accountsFromRows([
    row("a", "checking", null, 1_000),
    row("b", "investment", "401k", 0),
    row("c", "credit", "credit card", -500),
  ])
  assert.equal(accounts.length, 1)
  assert.deepEqual(accounts[0].source, { kind: "finance-account", refId: "a" })
})

test("debtsFromRows uses liability rates and payments, with defaults", () => {
  const debts = debtsFromRows(
    [row("m", "mortgage", "mortgage", 240_000), row("c", "credit", "credit card", 1_200)],
    [{ accountId: "m", rate: 0.065, monthlyPayment: 1_900 }],
  )
  assert.equal(debts[0].kind, "mortgage")
  assert.equal(debts[0].rate, 0.065)
  assert.equal(debts[0].monthlyPayment, 4_000)
  assert.equal(debts[1].kind, "credit")
  assert.equal(debts[1].monthlyPayment, 100)
})

test("expensesFromCategories folds small categories into Other spending", () => {
  const expenses = expensesFromCategories([
    { category: "Groceries", avgMonthly: 600 },
    { category: "Books", avgMonthly: 10 },
    { category: "Games", avgMonthly: 5 },
  ])
  assert.deepEqual(expenses.map((e) => [e.name, e.amount]), [["Groceries", 7_200], ["Other spending", 180]])
})

test("an imported draft validates", () => {
  const doc = {
    ...blankPlanDocument(new Date(2026, 0, 1)),
    accounts: accountsFromRows([row("a", "investment", "roth_ira", 5_000)]),
    debts: debtsFromRows([row("c", "credit", "credit card", 900)], []),
    expenses: expensesFromCategories([{ category: "Rent", avgMonthly: 2_000 }]),
  }
  assert.ok(planDocumentSchema.safeParse(doc).success)
})

test("applySourceBalances updates linked balances only and restarts the plan now", () => {
  const doc = {
    ...blankPlanDocument(new Date(2025, 0, 1)),
    accounts: [...accountsFromRows([row("a", "checking", null, 1_000)]), ...blankPlanDocument(new Date()).accounts],
  }
  const out = applySourceBalances(doc, { accounts: { a: 2_500 }, crypto: 0 }, new Date(2026, 8, 1))
  assert.equal(out.accounts[0].balance, 2_500)
  assert.equal(out.accounts[1].balance, 0)
  assert.equal(out.settings.startYear, 2026)
  assert.equal(out.settings.startMonth, 9)
})

test("spending three ways: average, typical month, or budgets (average where there's no budget)", () => {
  const categories = [
    { category: "Housing", avgMonthly: 2_000, medianMonthly: 1_800 },
    { category: "Travel", avgMonthly: 700, medianMonthly: 0 },
    { category: "Dining", avgMonthly: 400, medianMonthly: 350 },
  ]
  const opts = spendingOptions(categories, [
    { category: "Dining", monthlyLimit: 300 },
    { category: "Gifts", monthlyLimit: 100 },
    { category: "Housing", monthlyLimit: 0 },
  ])
  const yearly = (list: { name: string; amount: number }[]) => Object.fromEntries(list.map((e) => [e.name, e.amount]))
  assert.deepEqual(yearly(opts.average), { Housing: 24_000, Travel: 8_400, Dining: 4_800 })
  assert.deepEqual(yearly(opts.median), { Housing: 21_600, Dining: 4_200 })
  assert.deepEqual(yearly(opts.budget), { Housing: 24_000, Travel: 8_400, Dining: 3_600, Gifts: 1_200 })
  // The same category keeps its id whichever way it's measured.
  const id = (list: { name: string; id: string }[], name: string) => list.find((e) => e.name === name)?.id
  assert.equal(id(opts.average, "Dining"), id(opts.budget, "Dining"))
  assert.equal(id(opts.average, "Dining"), id(opts.median, "Dining"))
})
