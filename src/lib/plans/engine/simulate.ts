import { inflationOf, priceIndex, rateAt, type Inflation } from "../plan-inflation"
import { nominalRate, realRate } from "../plan-dollars"
import { ageAtStart, resolveTiming, timingContext, type TimingContext } from "../plan-timing"
import type { PlanAccount, PlanDocument, PlanProjection, YearRow } from "../plan-types"
import {
  applyAssetEvents,
  assetEntries,
  assetValueAt,
  assetValueChange,
  debtEntries,
  isOwned,
  payDebts,
  type AssetEntry,
  type DebtEntry,
} from "./engine-assets"
import { childTransfers } from "../plan-children"
import { expandPlan } from "../plan-expand"
import { adjustmentEntries, spendingFactorAt, type AdjustmentEntry } from "../plan-adjustments"
import { taxTrueUp, yearDeduction, yearTax } from "./engine-tax"
import { propertyYear } from "./engine-property"
import { realizeTrading } from "./engine-trading"

/** Differences smaller than this (dollars) aren't worth another pass. */
const TRUE_UP_MIN = 1
/** Each pass shrinks the difference by the marginal rate, so a few passes settle it. */
const MAX_TRUE_UP_PASSES = 6
import { coverDeficit, deposit, depositSurplus, type Holdings } from "./engine-cashflow"
import { applyTransfers, drawEarmarked, transferEntries, type TransferEntry } from "./engine-education"
import { applyDeposits, depositEntries, drainInherited, type DepositEntry } from "./engine-inheritance"
import {
  expenseEntries,
  expensesForYear,
  incomeEntries,
  incomeForYear,
  type ExpenseEntry,
  type IncomeEntry,
} from "./engine-flows"

/**
 * Options for one run (stress tests): `returnFor` overrides each account's nominal return per plan year;
 * `inflation` replaces the plan's own (history's actual inflation). Fixed-dollar amounts stay fixed.
 */
export interface SimulateOptions {
  returnFor?: (account: PlanAccount, index: number) => number
  inflation?: Inflation
}

interface Plan {
  doc: PlanDocument
  /** The plan's inflation: one rate, or a rate per year when following the market's curve. */
  inflation: Inflation
  returnFor?: SimulateOptions["returnFor"]
  ctx: TimingContext
  incomes: IncomeEntry[]
  expenses: ExpenseEntry[]
  assets: AssetEntry[]
  debts: DebtEntry[]
  milestoneYears: { name: string; index: number | null }[]
  transfers: TransferEntry[]
  adjustments: AdjustmentEntry[]
  deposits: DepositEntry[]
}

interface State {
  holdings: Holdings
  debtBalances: Record<string, number>
}

const sum = (record: Record<string, number>) => Object.values(record).reduce((s, v) => s + v, 0)

/**
 * On a year-by-year inflation path, account returns keep their real value: each is nominal at the plan's single
 * (equivalent) rate, so its real return is fixed and its nominal return moves with each year's inflation.
 * With one rate everywhere, returns are used as entered.
 */
function realReturnsOnPath(doc: PlanDocument, inflation: Inflation): SimulateOptions["returnFor"] {
  if (typeof inflation === "number") return undefined
  const base = doc.settings.inflation
  return (account, index) => nominalRate(realRate(account.returnRate, base), rateAt(inflation, index))
}

function preparePlan(original: PlanDocument, opts: SimulateOptions): Plan {
  const doc = expandPlan(original, opts.inflation)
  const ctx = timingContext(doc)
  const inflation = opts.inflation ?? inflationOf(doc.settings, ctx.length)
  return {
    doc,
    inflation,
    returnFor: opts.returnFor ?? realReturnsOnPath(doc, inflation),
    ctx,
    incomes: incomeEntries(doc.incomes, ctx),
    expenses: expenseEntries(doc.expenses, ctx),
    assets: assetEntries(doc.assets, ctx, inflation, doc.settings.inflation),
    debts: debtEntries(doc.debts, ctx),
    milestoneYears: doc.milestones.map((m) => ({ name: m.name, index: resolveTiming(m.timing, ctx) })),
    transfers: transferEntries(childTransfers(original), ctx),
    adjustments: adjustmentEntries(doc.adjustments ?? [], ctx),
    deposits: depositEntries(doc.deposits ?? [], ctx),
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

/** Grow every account by its return (or this year's override). Flows are applied at year end, after growth. */
function growHoldings(
  holdings: Holdings,
  doc: PlanDocument,
  index: number,
  returnFor?: SimulateOptions["returnFor"],
): { holdings: Holdings; growth: number } {
  let growth = 0
  const balances = { ...holdings.balances }
  for (const account of doc.accounts) {
    const gain = (balances[account.id] ?? 0) * (returnFor ? returnFor(account, index) : account.returnRate)
    balances[account.id] = (balances[account.id] ?? 0) + gain
    growth += gain
  }
  return { holdings: { ...holdings, balances }, growth }
}

function assetValuesAtEnd(plan: Plan, index: number): Record<string, number> {
  return Object.fromEntries(
    plan.assets.filter((a) => isOwned(a.range, index)).map((a) => [a.asset.id, assetValueAt(a, index + 1)]),
  )
}

/**
 * This year's money in and out, and how it's taxed, before anything moves between accounts. Homes come in
 * twice: sales and loans first (at the earned-income rates), then the year's tax again with rent taxed
 * and property tax and mortgage interest itemized where that helps.
 */
function yearFlows(plan: Plan, state: State, index: number) {
  const { startYear } = plan.doc.settings
  const { inflation } = plan
  const baseIncome = incomeForYear(plan.incomes, plan.doc.accounts, index, inflation)
  const earnedTax = yearTax(plan.doc, plan.adjustments, index, baseIncome, inflation)
  const events = applyAssetEvents(plan.assets, plan.debts, state.debtBalances, index, {
    capitalGainsRate: earnedTax.doc.settings.capitalGainsRate,
    incomeTaxRate: earnedTax.doc.settings.incomeTaxRate,
    joint: plan.doc.people.length > 1,
  })
  const debts = payDebts(plan.debts, events.debtBalances, index)
  const expenses = expensesForYear(plan.expenses, index, inflation, spendingFactorAt(plan.adjustments, index))
  const property = propertyYear({
    doc: plan.doc,
    ctx: plan.ctx,
    assets: plan.assets,
    index,
    year: startYear + index,
    expensesById: expenses.byId,
    incomeById: baseIncome.byId,
    interestBy: debts.interestBy,
    balanceBy: events.debtBalances,
  })
  const { itemized, rentalTaxable } = property
  const hasProperty = rentalTaxable > 0 || itemized.propertyTax > 0 || itemized.mortgageInterest > 0
  const income = rentalTaxable > 0 ? { ...baseIncome, taxableIncome: baseIncome.taxableIncome + rentalTaxable } : baseIncome
  const tax = hasProperty ? yearTax(plan.doc, plan.adjustments, index, income, inflation, itemized) : earnedTax
  return { doc: tax.doc, tax, events, debts, income, expenses, incomeTax: tax.incomeTax, rentalTaxable }
}

type Flows = ReturnType<typeof yearFlows>

/**
 * Grow accounts, then move money: payroll deposits, fixed contributions (529), earmarked draws
 * (college from a 529), inherited deposits and drawdowns, and finally the surplus or shortfall per
 * the cash-flow rules. `extraTax` is the bracket true-up owed on top of what was charged.
 */
function moveMoney(plan: Plan, state: State, index: number, flows: Flows, extraTax = 0) {
  const { doc } = flows
  const inflationFactor = priceIndex(plan.inflation, index)
  const grownState = growHoldings(state.holdings, doc, index, plan.returnFor)
  const trading = realizeTrading(state.holdings, grownState.holdings, doc)
  let holdings = trading.holdings
  for (const account of doc.accounts) {
    const payroll = flows.income.deposits[account.id]
    if (payroll) holdings = deposit(holdings, account, payroll)
  }
  const transfers = applyTransfers(plan.transfers, doc.accounts, holdings, index, plan.inflation)
  const earmarked = drawEarmarked(doc.expenses, flows.expenses.byId, transfers.holdings)
  const deposits = applyDeposits(plan.deposits, doc.accounts, earmarked.holdings, index, plan.inflation)
  const drained = drainInherited(doc.accounts, deposits.holdings, doc.settings.startYear + index, doc.settings.incomeTaxRate)
  holdings = drained.holdings
  const { income, expenses, debts, events, incomeTax } = flows
  const net =
    income.total - income.employeeContributions - incomeTax - extraTax - trading.tax - expenses.total - debts.paid -
    events.purchases + events.sales - events.saleTax - transfers.total + earmarked.drawn + drained.net
  const surplus = net >= 0 ? depositSurplus(net, holdings, doc, inflationFactor) : null
  const deficit = net < 0 ? coverDeficit(-net, holdings, doc, inflationFactor) : null
  return {
    holdings: surplus?.holdings ?? deficit?.holdings ?? holdings,
    growth: grownState.growth,
    trading,
    contributionsBy: mergeSums(mergeSums(income.deposits, transfers.byAccount), surplus?.depositsBy ?? {}),
    withdrawalsBy: mergeSums(mergeSums(earmarked.byAccount, drained.byAccount), deficit?.withdrawalsBy ?? {}),
    deposits,
    drained,
    surplusBy: surplus?.depositsBy ?? {},
    shortfallBy: deficit?.withdrawalsBy ?? {},
    deficit,
  }
}

type Moved = ReturnType<typeof moveMoney>

/** What's taxed this year beyond earned income: withdrawals, and gains from sales, drawdowns and trading. */
function taxedAmounts(flows: Flows, moved: Moved) {
  return {
    ordinaryWithdrawn: (moved.deficit?.ordinaryWithdrawn ?? 0) + moved.drained.taxable,
    shortGains: (moved.deficit?.shortGainsRealized ?? 0) + flows.events.saleShortGains + moved.trading.shortGains,
    longGains: (moved.deficit?.gainsRealized ?? 0) + flows.events.saleGains + moved.trading.longGains,
    realEstateGains: flows.events.saleRealEstateGains,
  }
}

/**
 * Under brackets: tax the year's final totals exactly and settle the difference from cash flow.
 * Paying the difference can mean withdrawing (and being taxed on) a bit more, so repeat until it settles.
 */
function settleTax(plan: Plan, state: State, index: number, flows: Flows): { moved: Moved; trueUp: number } {
  let trueUp = 0
  let moved = moveMoney(plan, state, index, flows)
  if (!flows.tax.situation) return { moved, trueUp }
  for (let pass = 0; pass < MAX_TRUE_UP_PASSES; pass++) {
    const diff = taxTrueUp(flows.tax, {
      ...taxedAmounts(flows, moved),
      charged: flows.incomeTax + trueUp + (moved.deficit?.tax ?? 0) + moved.drained.tax + flows.events.saleTax + moved.trading.tax,
    })
    if (Math.abs(diff) < TRUE_UP_MIN) break
    trueUp += diff
    moved = moveMoney(plan, state, index, flows, trueUp)
  }
  return { moved, trueUp }
}

function stepYear(plan: Plan, state: State, index: number): { row: YearRow; state: State } {
  const { doc } = plan
  const flows = yearFlows(plan, state, index)
  const { moved, trueUp } = settleTax(plan, state, index, flows)
  const { income, expenses, debts, events, incomeTax } = flows
  const assetValues = assetValuesAtEnd(plan, index)
  const valueChange = assetValueChange(plan.assets, index)
  const accountsTotal = sum(moved.holdings.balances)
  const assetsTotal = sum(assetValues)
  const debtsTotal = sum(debts.debtBalances)
  const row: YearRow = {
    index,
    year: doc.settings.startYear + index,
    ages: doc.people.map((p) => ageAtStart(p, doc.settings) + index),
    income: income.total,
    incomeBy: income.byId,
    employerMatch: income.employerMatch,
    employerMatchBy: income.matchBy,
    incomeTax: incomeTax + trueUp,
    withdrawalTax: (moved.deficit?.tax ?? 0) + moved.drained.tax,
    saleTax: events.saleTax,
    tradingTax: moved.trading.tax,
    realizedGains: moved.trading.shortGains + moved.trading.longGains,
    deposits: moved.deposits.total,
    depositsBy: moved.deposits.byAccount,
    splitOut: moved.deposits.splitOut,
    taxableIncome:
      income.taxableIncome + (moved.deficit?.taxableWithdrawn ?? 0) + moved.drained.taxable +
      moved.trading.shortGains + moved.trading.longGains,
    expenses: expenses.total,
    expensesBy: expenses.byId,
    debtPayments: debts.paid,
    debtPaymentsBy: debts.paidBy,
    debtInterest: debts.interest,
    debtInterestBy: debts.interestBy,
    rentalTaxable: flows.rentalTaxable,
    deduction: yearDeduction(flows.tax, taxedAmounts(flows, moved)),
    assetPurchases: events.purchases,
    assetSales: events.sales,
    contributions: sum(moved.contributionsBy),
    contributionsBy: moved.contributionsBy,
    withdrawals: sum(moved.withdrawalsBy),
    withdrawalsBy: moved.withdrawalsBy,
    surplusBy: moved.surplusBy,
    shortfallBy: moved.shortfallBy,
    growth: moved.growth,
    assetAppreciation: valueChange.appreciation,
    assetDepreciation: valueChange.depreciation,
    balances: moved.holdings.balances,
    assetValues,
    debtBalances: debts.debtBalances,
    accountsTotal,
    assetsTotal,
    debtsTotal,
    netWorth: accountsTotal + assetsTotal - debtsTotal,
    financialNetWorth: accountsTotal - debtsTotal,
    shortfall: moved.deficit?.shortfall ?? 0,
    milestones: plan.milestoneYears.filter((m) => m.index === index).map((m) => m.name),
  }
  return { row, state: { holdings: moved.holdings, debtBalances: debts.debtBalances } }
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
export function simulatePlan(doc: PlanDocument, opts: SimulateOptions = {}): PlanProjection {
  const plan = preparePlan(doc, opts)
  let state: State = { holdings: initialHoldings(plan.doc), debtBalances: {} }
  const rows: YearRow[] = []
  for (let index = 0; index < plan.ctx.length; index++) {
    const step = stepYear(plan, state, index)
    rows.push(step.row)
    state = step.state
  }
  const start = startTotals(plan)
  return { rows, startNetWorth: start.netWorth, startFinancialNetWorth: start.financial }
}
