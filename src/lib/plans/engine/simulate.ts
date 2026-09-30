import { ageAtStart, resolveTiming, timingContext, type TimingContext } from "../plan-timing"
import type { PlanDocument, PlanProjection, YearRow } from "../plan-types"
import {
  applyAssetEvents,
  assetEntries,
  assetValueAt,
  debtEntries,
  isOwned,
  payDebts,
  type AssetEntry,
  type DebtEntry,
} from "./engine-assets"
import { coverDeficit, deposit, depositSurplus, type Holdings } from "./engine-cashflow"
import {
  expenseEntries,
  expensesForYear,
  incomeEntries,
  incomeForYear,
  type ExpenseEntry,
  type IncomeEntry,
} from "./engine-flows"

interface Plan {
  doc: PlanDocument
  ctx: TimingContext
  incomes: IncomeEntry[]
  expenses: ExpenseEntry[]
  assets: AssetEntry[]
  debts: DebtEntry[]
  milestoneYears: { name: string; index: number | null }[]
}

interface State {
  holdings: Holdings
  debtBalances: Record<string, number>
}

const sum = (record: Record<string, number>) => Object.values(record).reduce((s, v) => s + v, 0)

function preparePlan(doc: PlanDocument): Plan {
  const ctx = timingContext(doc)
  return {
    doc,
    ctx,
    incomes: incomeEntries(doc.incomes, ctx),
    expenses: expenseEntries(doc.expenses, ctx),
    assets: assetEntries(doc.assets, ctx),
    debts: debtEntries(doc.debts, ctx),
    milestoneYears: doc.milestones.map((m) => ({ name: m.name, index: resolveTiming(m.timing, ctx) })),
  }
}

function initialHoldings(doc: PlanDocument): Holdings {
  return {
    balances: Object.fromEntries(doc.accounts.map((a) => [a.id, a.balance])),
    basis: Object.fromEntries(
      doc.accounts.filter((a) => a.taxTreatment === "taxable").map((a) => [a.id, a.costBasis ?? a.balance]),
    ),
  }
}

/** Grow every account by its return. Flows are applied at year end, after growth. */
function growHoldings(holdings: Holdings, doc: PlanDocument): { holdings: Holdings; growth: number } {
  let growth = 0
  const balances = { ...holdings.balances }
  for (const account of doc.accounts) {
    const gain = (balances[account.id] ?? 0) * account.returnRate
    balances[account.id] = (balances[account.id] ?? 0) + gain
    growth += gain
  }
  return { holdings: { ...holdings, balances }, growth }
}

function assetValuesAtEnd(plan: Plan, index: number): Record<string, number> {
  return Object.fromEntries(
    plan.assets.filter((a) => isOwned(a.range, index)).map((a) => [a.asset.id, assetValueAt(a.asset, index + 1)]),
  )
}

function stepYear(plan: Plan, state: State, index: number): { row: YearRow; state: State } {
  const { doc } = plan
  const { inflation } = doc.settings
  const events = applyAssetEvents(plan.assets, plan.debts, state.debtBalances, index)
  const debts = payDebts(plan.debts, events.debtBalances, index)
  const income = incomeForYear(plan.incomes, doc.accounts, index, inflation)
  const expenses = expensesForYear(plan.expenses, index, inflation)
  const incomeTax = income.taxableIncome * doc.settings.incomeTaxRate

  const grownState = growHoldings(state.holdings, doc)
  let holdings = grownState.holdings
  for (const account of doc.accounts) {
    const payroll = income.deposits[account.id]
    if (payroll) holdings = deposit(holdings, account, payroll)
  }

  const net =
    income.total - income.employeeContributions - incomeTax - expenses.total - debts.paid -
    events.purchases + events.sales
  const inflationFactor = Math.pow(1 + inflation, index)
  const surplus = net >= 0 ? depositSurplus(net, holdings, doc, inflationFactor) : null
  const deficit = net < 0 ? coverDeficit(-net, holdings, doc) : null
  holdings = surplus?.holdings ?? deficit?.holdings ?? holdings

  const contributionsBy = mergeSums(income.deposits, surplus?.depositsBy ?? {})
  const assetValues = assetValuesAtEnd(plan, index)
  const accountsTotal = sum(holdings.balances)
  const assetsTotal = sum(assetValues)
  const debtsTotal = sum(debts.debtBalances)
  const row: YearRow = {
    index,
    year: doc.settings.startYear + index,
    ages: doc.people.map((p) => ageAtStart(p, doc.settings) + index),
    income: income.total,
    incomeBy: income.byId,
    employerMatch: income.employerMatch,
    incomeTax,
    withdrawalTax: deficit?.tax ?? 0,
    expenses: expenses.total,
    expensesBy: expenses.byId,
    debtPayments: debts.paid,
    assetPurchases: events.purchases,
    assetSales: events.sales,
    contributions: sum(contributionsBy),
    contributionsBy,
    withdrawals: sum(deficit?.withdrawalsBy ?? {}),
    withdrawalsBy: deficit?.withdrawalsBy ?? {},
    growth: grownState.growth,
    balances: holdings.balances,
    assetValues,
    debtBalances: debts.debtBalances,
    accountsTotal,
    assetsTotal,
    debtsTotal,
    netWorth: accountsTotal + assetsTotal - debtsTotal,
    financialNetWorth: accountsTotal - debtsTotal,
    shortfall: deficit?.shortfall ?? 0,
    milestones: plan.milestoneYears.filter((m) => m.index === index).map((m) => m.name),
  }
  return { row, state: { holdings, debtBalances: debts.debtBalances } }
}

function mergeSums(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}

/** Starting net worth: accounts, assets already owned and debts already running. */
function startTotals(plan: Plan): { netWorth: number; financial: number } {
  const accounts = plan.doc.accounts.reduce((s, a) => s + a.balance, 0)
  const assets = plan.assets.filter((a) => a.range.start <= 0).reduce((s, a) => s + a.asset.value, 0)
  const debts = plan.debts.filter((d) => d.start === 0).reduce((s, d) => s + d.debt.balance, 0)
  return { netWorth: accounts + assets - debts, financial: accounts - debts }
}

/** Year-by-year projection of a plan, in nominal dollars. Pure; safe on client and server. */
export function simulatePlan(doc: PlanDocument): PlanProjection {
  const plan = preparePlan(doc)
  let state: State = { holdings: initialHoldings(doc), debtBalances: {} }
  const rows: YearRow[] = []
  for (let index = 0; index < plan.ctx.length; index++) {
    const step = stepYear(plan, state, index)
    rows.push(step.row)
    state = step.state
  }
  const start = startTotals(plan)
  return { rows, startNetWorth: start.netWorth, startFinancialNetWorth: start.financial }
}
