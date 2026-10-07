import { inflationOf, priceIndex, rateAt, type Inflation } from "../plan-inflation"
import { UNPAID_BILLS_ID } from "../plan-constants"
import { nominalRate, realRate } from "../plan-dollars"
import { ageAtStart, resolveTiming, timingContext, type TimingContext } from "../plan-timing"
import type { HomeSale, PlanAccount, PlanDocument, PlanIncome, PlanProjection, YearRow } from "../plan-types"
import { plannedPricing, replayedPricing, type EquityPricing } from "./engine-equity"
import { homeToSellAt, SHORTFALL, withHomeSold, withPlannedSaleEarly } from "../plan-home-fallback"
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
import { taxesByKind, taxTrueUp, yearDeduction, yearMinimumTax, yearPayroll, yearTax } from "./engine-tax"
import { socialSecurityYear, type WithheldMonths } from "./engine-social-security"
import { estimatedPia } from "../ss-plan-earnings"
import { thresholdIndex } from "../tax/tax-calc"
import { propertyYear } from "./engine-property"
import { realizeTrading } from "./engine-trading"
import { penalizedAccounts, takeRequired } from "./engine-rmd"
import { NO_RULE, ruleYear, rulePortfolio, type RuleState } from "./engine-spending-rule"
import { conversionEntries, convertYear, NO_CONVERSION, type ConversionEntry } from "./engine-conversions"
import { initialRothLedgers, rothTranches, withInflows, withWithdrawals, type RothLedgers } from "./engine-roth-ledger"
import { retirementAge } from "../plan-spending-patterns"

/** Differences smaller than this (dollars) aren't worth another pass. */
const TRUE_UP_MIN = 1
/** Each pass shrinks the difference by the marginal rate, so a few passes settle it. */
const MAX_TRUE_UP_PASSES = 6
/** Conversions sized to a bracket also move with last pass's shortfall draws, so allow a couple more. */
const MAX_PASSES_WITH_CONVERSIONS = 8
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
 * `equityReturnFor` does the same for the stock behind each equity grant; `inflation` replaces the plan's own
 * (history's actual inflation). Fixed-dollar amounts stay fixed.
 */
export interface SimulateOptions {
  returnFor?: (account: PlanAccount, index: number) => number
  equityReturnFor?: (income: PlanIncome, index: number) => number
  inflation?: Inflation
  /** Market valuation (CAPE) per plan year for a CAPE spending rule: the latest, held flat, or history's in a stress run. */
  capeFor?: (index: number) => number | null
  /** Carry out homes' backup plans when the money runs out. Only the stress test sets it; the plan itself never sells. */
  homeFallbacks?: boolean
}

interface Plan {
  doc: PlanDocument
  /** The plan's inflation: one rate, or a rate per year when following the market's curve. */
  inflation: Inflation
  returnFor?: SimulateOptions["returnFor"]
  capeFor?: SimulateOptions["capeFor"]
  /** First plan year at or after retirement (a spending rule starts then); null without a retirement in the plan. */
  retireIndex: number | null
  /** How equity grants' stock prices move (planned growth, or the stress test's market path). */
  equityPricing: EquityPricing
  ctx: TimingContext
  incomes: IncomeEntry[]
  expenses: ExpenseEntry[]
  assets: AssetEntry[]
  debts: DebtEntry[]
  milestoneYears: { name: string; index: number | null }[]
  transfers: TransferEntry[]
  adjustments: AdjustmentEntry[]
  deposits: DepositEntry[]
  /** Social Security estimated from earnings records (plus the plan's own salaries), by income id. */
  ssEstimates: Record<string, { pia: number; eligibleYear: number | null }>
  conversions: ConversionEntry[]
}

interface State {
  holdings: Holdings
  debtBalances: Record<string, number>
  /** Social Security months withheld by the earnings test so far, per income. */
  ssWithheld: WithheldMonths
  /** Minimum tax credit from ISO years' AMT, not yet used against regular tax. */
  amtCredit: number
  /** Where the spending rule stands (factor 1 without one). */
  rule: RuleState
  /** Bills the accounts couldn't pay so far, nominal: they pile up as a debt. */
  unpaid: number
  /** Roth contributions and conversion lots, for the 5-year rule (only kept when the plan converts). */
  roth: RothLedgers
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
    capeFor: opts.capeFor,
    retireIndex: retireIndexOf(doc),
    equityPricing: opts.equityReturnFor ? replayedPricing(opts.equityReturnFor) : plannedPricing(inflation),
    ctx,
    incomes: incomeEntries(doc.incomes, ctx),
    expenses: expenseEntries(doc.expenses, ctx),
    assets: assetEntries(doc.assets, ctx, inflation, doc.settings.inflation),
    debts: debtEntries(doc.debts, ctx),
    milestoneYears: doc.milestones.map((m) => ({ name: m.name, index: resolveTiming(m.timing, ctx) })),
    transfers: transferEntries(childTransfers(original), ctx),
    adjustments: adjustmentEntries(doc.adjustments ?? [], ctx),
    deposits: depositEntries(doc.deposits ?? [], ctx),
    conversions: conversionEntries(doc, ctx),
    ssEstimates: Object.fromEntries(
      doc.incomes.flatMap((i) => {
        const estimate = estimatedPia(doc, i)
        return estimate ? [[i.id, { pia: estimate.pia, eligibleYear: estimate.eligibleYear }]] : []
      }),
    ),
  }
}

function retireIndexOf(doc: PlanDocument): number | null {
  const age = retirementAge(doc)
  const person = doc.people[0]
  return age === null || !person ? null : Math.max(0, age - ageAtStart(person, doc.settings))
}

/** This year's spending rule: planned flexible spending (after spending changes) against last year-end's portfolio. */
function spendingRule(plan: Plan, state: State, index: number, adjust: number): { rule: RuleState; planned: number } {
  const planned = expensesForYear(plan.expenses, index, plan.inflation, adjust).total
  const rule = plan.doc.settings.spendingRule
  if (!rule) return { rule: state.rule, planned }
  const fixed = expensesForYear(plan.expenses, index, plan.inflation, 0).total
  const next = ruleYear(rule, {
    planned: planned - fixed,
    portfolio: rulePortfolio(plan.doc, state.holdings),
    retired: plan.retireIndex !== null && index >= plan.retireIndex,
    cape: plan.capeFor?.(index) ?? null,
  }, state.rule)
  return { rule: next, planned }
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
  const ss = socialSecurityYear(
    { doc: plan.doc, entries: plan.incomes, adjustments: plan.adjustments, index, inflation, wageIndex: thresholdIndex(startYear + index, inflation, startYear), estimates: plan.ssEstimates },
    incomeForYear(plan.incomes, plan.doc.accounts, index, inflation, plan.equityPricing),
    state.ssWithheld,
  )
  const grossIncome = ss.income
  const payroll = yearPayroll(plan.doc, plan.incomes, plan.adjustments, index, grossIncome, inflation)
  // Half of self-employment tax comes off income before income tax.
  const baseIncome = payroll.seDeduction > 0 ? { ...grossIncome, taxableIncome: Math.max(0, grossIncome.taxableIncome - payroll.seDeduction) } : grossIncome
  const earnedTax = yearTax(plan.doc, plan.adjustments, index, baseIncome, inflation, undefined, state.amtCredit)
  const events = applyAssetEvents(plan.assets, plan.debts, state.debtBalances, index, {
    capitalGainsRate: earnedTax.doc.settings.capitalGainsRate,
    incomeTaxRate: earnedTax.doc.settings.incomeTaxRate,
    joint: plan.doc.people.length > 1,
  })
  const debts = payDebts(plan.debts, events.debtBalances, index)
  const adjust = spendingFactorAt(plan.adjustments, index)
  const ruled = spendingRule(plan, state, index, adjust)
  const expenses = expensesForYear(plan.expenses, index, inflation, adjust * ruled.rule.factor)
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
  const tax = hasProperty ? yearTax(plan.doc, plan.adjustments, index, income, inflation, itemized, state.amtCredit) : earnedTax
  return { doc: tax.doc, tax, events, debts, income, expenses, ruled, incomeTax: tax.incomeTax, payroll, rentalTaxable, ssWithheld: ss.withheld }
}

type Flows = ReturnType<typeof yearFlows>

/**
 * Grow accounts, then move money: payroll deposits, fixed contributions (529), earmarked draws
 * (college from a 529), inherited deposits and drawdowns, and finally the surplus or shortfall per
 * the cash-flow rules. `extraTax` is the bracket true-up owed on top of what was charged.
 */
function moveMoney(plan: Plan, state: State, index: number, flows: Flows, extraTax = 0, hint: Hint = NO_HINT) {
  const { doc } = flows
  const inflationFactor = priceIndex(plan.inflation, index)
  const grownState = growHoldings(state.holdings, doc, index, plan.returnFor)
  const trading = realizeTrading(state.holdings, grownState.holdings, doc)
  let holdings = trading.holdings
  for (const account of doc.accounts) {
    const payroll = flows.income.deposits[account.id]
    if (payroll) holdings = deposit(holdings, account, payroll, payroll - (flows.income.unbased[account.id] ?? 0))
  }
  const transfers = applyTransfers(plan.transfers, doc.accounts, holdings, index, plan.inflation)
  const earmarked = drawEarmarked(doc.expenses, flows.expenses.byId, transfers.holdings)
  const deposits = applyDeposits(plan.deposits, doc.accounts, earmarked.holdings, index, plan.inflation)
  const year = doc.settings.startYear + index
  const drained = drainInherited(doc.accounts, deposits.holdings, year, doc.settings.incomeTaxRate)
  // Required withdrawals are figured on last year-end's balances (before this year's growth).
  const required = takeRequired(doc, state.holdings, drained.holdings, year, doc.settings.incomeTaxRate)
  const { income, expenses, debts, events, incomeTax } = flows
  const conversion = plan.conversions.length > 0
    ? convertYear(plan.conversions, required.holdings, {
        doc, tax: flows.tax, index, year, inflationFactor,
        prior: {
          ordinaryWithdrawn: drained.taxable + required.taxable + hint.ordinaryWithdrawn,
          shortGains: events.saleShortGains + trading.shortGains + hint.shortGains,
          longGains: events.saleGains + trading.longGains + hint.longGains,
          realEstateGains: events.saleRealEstateGains,
        },
      })
    : { ...NO_CONVERSION, holdings: required.holdings }
  holdings = conversion.holdings
  const net =
    income.total - income.employeeContributions - incomeTax - flows.payroll.total - extraTax - trading.tax - expenses.total - debts.paid -
    events.purchases + events.sales + events.borrowed - events.saleTax - transfers.total + earmarked.drawn + drained.net + required.net + conversion.net
  const tranches = plan.conversions.length > 0 ? rothTranches(withInflows(state.roth, {}, conversion.intoBy, year), doc, year) : {}
  const surplus = net >= 0 ? depositSurplus(net, holdings, doc, inflationFactor) : null
  const deficit = net < 0 ? coverDeficit(-net, holdings, doc, inflationFactor, penalizedAccounts(doc, year), tranches) : null
  return {
    holdings: surplus?.holdings ?? deficit?.holdings ?? holdings,
    growth: grownState.growth,
    trading,
    contributionsBy: mergeSums(mergeSums(income.deposits, transfers.byAccount), surplus?.depositsBy ?? {}),
    withdrawalsBy: mergeSums(mergeSums(mergeSums(mergeSums(earmarked.byAccount, drained.byAccount), required.byAccount), deficit?.withdrawalsBy ?? {}), conversion.withheldBy),
    deposits,
    drained,
    required,
    surplusBy: surplus?.depositsBy ?? {},
    shortfallBy: deficit?.withdrawalsBy ?? {},
    deficit,
    conversion,
  }
}

type Moved = ReturnType<typeof moveMoney>

/** Shortfall draws from the previous pass: conversions sized to a bracket count them as the year's income. */
interface Hint {
  ordinaryWithdrawn: number
  shortGains: number
  longGains: number
}

const NO_HINT: Hint = { ordinaryWithdrawn: 0, shortGains: 0, longGains: 0 }

function hintOf(moved: Moved): Hint {
  const d = moved.deficit
  return { ordinaryWithdrawn: d?.ordinaryWithdrawn ?? 0, shortGains: d?.shortGainsRealized ?? 0, longGains: d?.gainsRealized ?? 0 }
}

const hintMoved = (a: Hint, b: Hint) =>
  Math.abs(a.ordinaryWithdrawn - b.ordinaryWithdrawn) + Math.abs(a.shortGains - b.shortGains) + Math.abs(a.longGains - b.longGains) >= TRUE_UP_MIN

/** What's taxed this year beyond earned income: withdrawals, and gains from sales, drawdowns and trading. */
function taxedAmounts(flows: Flows, moved: Moved) {
  return {
    ordinaryWithdrawn: (moved.deficit?.ordinaryWithdrawn ?? 0) + moved.drained.taxable + moved.required.taxable + moved.conversion.taxable,
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
  let hint = NO_HINT
  let moved = moveMoney(plan, state, index, flows)
  if (!flows.tax.situation) return { moved, trueUp }
  const converts = plan.conversions.length > 0
  for (let pass = 0; pass < (converts ? MAX_PASSES_WITH_CONVERSIONS : MAX_TRUE_UP_PASSES); pass++) {
    const diff = taxTrueUp(flows.tax, {
      ...taxedAmounts(flows, moved),
      charged:
        flows.incomeTax + trueUp + (moved.deficit?.tax ?? 0) + moved.drained.tax + moved.required.tax + flows.events.saleTax +
        moved.trading.tax + moved.conversion.tax,
    })
    const next = converts ? hintOf(moved) : NO_HINT
    if (Math.abs(diff) < TRUE_UP_MIN && !hintMoved(hint, next)) break
    trueUp += diff
    hint = next
    moved = moveMoney(plan, state, index, flows, trueUp, hint)
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
  // Bills the accounts can't pay don't vanish: they pile up as a debt (borrowing to stay afloat), so net worth counts them.
  const shortfall = moved.deficit?.shortfall ?? 0
  const unpaid = state.unpaid + shortfall
  const debtBalances = unpaid > 0 ? { ...debts.debtBalances, [UNPAID_BILLS_ID]: unpaid } : debts.debtBalances
  const debtsTotal = sum(debtBalances)
  const { conversion } = moved
  const withdrawalTax = (moved.deficit?.tax ?? 0) + moved.drained.tax + moved.required.tax + conversion.tax
  const kinds = taxesByKind(flows.tax, taxedAmounts(flows, moved), incomeTax + trueUp + withdrawalTax + events.saleTax + moved.trading.tax)
  const row: YearRow = {
    index,
    year: doc.settings.startYear + index,
    ages: doc.people.map((p) => ageAtStart(p, doc.settings) + index),
    income: income.total,
    incomeBy: income.byId,
    employerMatch: income.employerMatch,
    employerMatchBy: income.matchBy,
    incomeTax: incomeTax + trueUp,
    payrollTax: flows.payroll.total,
    withdrawalTax,
    ordinaryIncomeTax: kinds.ordinary,
    shortGainsTax: kinds.shortGains,
    longGainsTax: kinds.longGains,
    earnedIncomeTax: kinds.earnedOnly,
    earlyWithdrawalPenalty: (moved.deficit?.penalty ?? 0) + conversion.penalty,
    saleTax: events.saleTax,
    tradingTax: moved.trading.tax,
    realizedGains: moved.trading.shortGains + moved.trading.longGains,
    deposits: moved.deposits.total,
    depositsBy: moved.deposits.byAccount,
    splitOut: moved.deposits.splitOut,
    taxableIncome:
      income.taxableIncome + (moved.deficit?.taxableWithdrawn ?? 0) + moved.drained.taxable + moved.required.taxable +
      moved.trading.shortGains + moved.trading.longGains + conversion.taxable,
    expenses: expenses.total,
    expensesBy: expenses.byId,
    plannedSpending: flows.ruled.planned,
    spendingFactor: flows.ruled.rule.factor,
    debtPayments: debts.paid,
    debtPaymentsBy: debts.paidBy,
    debtInterest: debts.interest,
    debtInterestBy: debts.interestBy,
    rentalTaxable: flows.rentalTaxable,
    deduction: yearDeduction(flows.tax, taxedAmounts(flows, moved)),
    assetPurchases: events.purchases,
    assetSales: events.sales,
    borrowed: events.borrowed,
    contributions: sum(moved.contributionsBy),
    contributionsBy: moved.contributionsBy,
    withdrawals: sum(moved.withdrawalsBy),
    withdrawalsBy: moved.withdrawalsBy,
    requiredWithdrawals: sum(moved.required.byAccount),
    requiredBy: moved.required.byAccount,
    conversions: conversion.taxable,
    conversionsBy: conversion.fromBy,
    conversionsInto: conversion.intoBy,
    conversionTax: conversion.attributableTax,
    surplusBy: moved.surplusBy,
    shortfallBy: moved.shortfallBy,
    growth: moved.growth,
    assetAppreciation: valueChange.appreciation,
    assetDepreciation: valueChange.depreciation,
    balances: moved.holdings.balances,
    assetValues,
    debtBalances,
    accountsTotal,
    assetsTotal,
    debtsTotal,
    netWorth: accountsTotal + assetsTotal - debtsTotal,
    financialNetWorth: accountsTotal - debtsTotal,
    shortfall,
    milestones: plan.milestoneYears.filter((m) => m.index === index).map((m) => m.name),
  }
  const minimum = yearMinimumTax(flows.tax, taxedAmounts(flows, moved))
  const amtCredit = state.amtCredit - (minimum?.creditUsed ?? 0) + (minimum?.creditEarned ?? 0)
  const roth = plan.conversions.length > 0 ? withWithdrawals(withInflows(state.roth, moved.contributionsBy, conversion.intoBy, row.year), moved.withdrawalsBy) : state.roth
  return { row, state: { holdings: moved.holdings, debtBalances: debts.debtBalances, ssWithheld: flows.ssWithheld, amtCredit, rule: flows.ruled.rule, unpaid, roth } }
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

/** Most homes whose backup plans one run can carry out (each sale is one re-run). */
const MAX_HOME_SALES = 5

/**
 * Year-by-year projection of a plan, in nominal dollars. Pure; safe on client and server. With `homeFallbacks` (the
 * stress test), when the accounts would run dry and a home is still owned that the plan sells later, or that has a
 * backup plan ("if the money runs out"), that home is sold at the start of that year and the plan runs again, once
 * per home.
 */
export function simulatePlan(doc: PlanDocument, opts: SimulateOptions = {}): PlanProjection {
  let current = doc
  const homeSales: HomeSale[] = []
  for (let sales = 0; ; sales++) {
    const projection = simulateOnce(current, opts)
    const short = projection.rows.find((r) => r.shortfall > SHORTFALL)
    const pick = short && opts.homeFallbacks && sales < MAX_HOME_SALES ? homeToSellAt(current, short.index) : null
    if (!short || !pick) return homeSales.length > 0 ? { ...projection, homeSales } : projection
    const sold = pick.early ? withPlannedSaleEarly(current, pick.home, short.index) : withHomeSold(current, pick.home, short.index)
    current = sold.doc
    homeSales.push(sold.sale)
  }
}

function simulateOnce(doc: PlanDocument, opts: SimulateOptions): PlanProjection {
  const plan = preparePlan(doc, opts)
  const roth = plan.conversions.length > 0 ? initialRothLedgers(plan.doc) : {}
  let state: State = { holdings: initialHoldings(plan.doc), debtBalances: {}, ssWithheld: {}, amtCredit: 0, rule: NO_RULE, unpaid: 0, roth }
  const rows: YearRow[] = []
  for (let index = 0; index < plan.ctx.length; index++) {
    const step = stepYear(plan, state, index)
    rows.push(step.row)
    state = step.state
  }
  const start = startTotals(plan)
  return { rows, startNetWorth: start.netWorth, startFinancialNetWorth: start.financial }
}
