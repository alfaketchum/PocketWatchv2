import type { Inflation } from "../plan-inflation"
import { filingStatusAt, stateAt, taxRatesAt, type AdjustmentEntry } from "../plan-adjustments"
import { federalDeduction, marginalRates, stateTax, taxBase, thresholdIndex, totalTax, type TaxBase, type TaxSituation } from "../tax/tax-calc"
import type { Itemized } from "../tax/itemized-2026"
import type { PlanDocument } from "../plan-types"
import type { IncomeEntry, IncomeYear } from "./engine-flows"
import { payrollTax, type PayrollTax } from "../tax/payroll-2026"
import { WAGE_KINDS } from "../plan-constants"

const SELF_EMPLOYED: ReadonlySet<string> = new Set(["business"])

export interface YearTax {
  /** The plan with this year's withdrawal tax rates (flat rates, or marginal rates under brackets). */
  doc: PlanDocument
  /** Set under brackets; null for flat rates. */
  situation: TaxSituation | null
  /** Tax on earned income (wages, pensions, taxable Social Security…). */
  incomeTax: number
  /** Ordinary taxable income before withdrawals (Social Security apart), for the year-end true-up. */
  earnedOrdinary: number
  /** Social Security received; how much is taxable depends on the year's other income. */
  socialSecurity: number
}

/** Social Security benefits this year (the taxable part is worked out with the rest of the year's income). */
function socialSecurityReceived(doc: PlanDocument, income: IncomeYear): number {
  return doc.incomes.filter((i) => i.kind === "social_security" && i.taxable).reduce((s, i) => s + (income.byId[i.id] ?? 0), 0)
}

/**
 * How this year is taxed: flat rates (with any changes over time), or brackets for the year's status and state,
 * itemizing property tax and mortgage interest when that beats the standard deduction.
 */
export function yearTax(
  doc: PlanDocument,
  adjustments: AdjustmentEntry[],
  index: number,
  income: IncomeYear,
  inflation: Inflation,
  itemized?: Itemized,
): YearTax {
  const settings = doc.settings
  if (settings.taxMode !== "brackets") {
    const rates = taxRatesAt(adjustments, settings, index)
    const yearDoc = adjustments.length ? { ...doc, settings: { ...settings, ...rates } } : doc
    return { doc: yearDoc, situation: null, incomeTax: income.taxableIncome * rates.incomeTaxRate, earnedOrdinary: income.taxableIncome, socialSecurity: 0 }
  }
  const situation: TaxSituation = {
    status: filingStatusAt(adjustments, settings, index),
    state: stateAt(adjustments, settings, index),
    index: thresholdIndex(settings.startYear + index, inflation, settings.startYear),
    ...(itemized ? { itemized } : {}),
  }
  const socialSecurity = socialSecurityReceived(doc, income)
  const earnedOrdinary = Math.max(0, income.taxableIncome - socialSecurity)
  const earned = taxBase({ ordinary: earnedOrdinary, socialSecurity })
  const marginal = marginalRates(earned, situation)
  return {
    // Withdrawals are grossed up at these; short-term gains use the ordinary rate. The true-up settles the rest.
    doc: { ...doc, settings: { ...settings, incomeTaxRate: marginal.ordinary, capitalGainsRate: marginal.longGains } },
    situation,
    incomeTax: totalTax(earned, situation),
    earnedOrdinary,
    socialSecurity,
  }
}

/**
 * Payroll tax for the year: taxable salaries and equity pay are wages (Social Security up to the wage base, Medicare on all),
 * taxable business income is self-employment. Pre-tax 401(k) contributions don't lower it.
 */
export function yearPayroll(
  doc: PlanDocument,
  entries: IncomeEntry[],
  adjustments: AdjustmentEntry[],
  index: number,
  income: IncomeYear,
  inflation: Inflation,
): PayrollTax {
  const amounts = (kinds: ReadonlySet<string>) =>
    entries.filter((e) => kinds.has(e.income.kind) && e.income.taxable).map((e) => income.byId[e.income.id] ?? 0).filter((v) => v > 0)
  const { settings } = doc
  return payrollTax(amounts(WAGE_KINDS), amounts(SELF_EMPLOYED), filingStatusAt(adjustments, settings, index), thresholdIndex(settings.startYear + index, inflation, settings.startYear))
}

export interface TaxedAmounts {
  /** Ordinary income from withdrawals (traditional accounts, inherited IRAs). */
  ordinaryWithdrawn: number
  /** Realized gains from taxable withdrawals and asset sales, by holding period. */
  shortGains: number
  longGains: number
  /** Of `longGains`: from selling real estate. */
  realEstateGains: number
  /** Tax already charged this year. */
  charged: number
}

function finalBase(tax: YearTax, amounts: Omit<TaxedAmounts, "charged">): TaxBase {
  return taxBase({
    ordinary: tax.earnedOrdinary + amounts.ordinaryWithdrawn,
    shortGains: amounts.shortGains,
    longGains: amounts.longGains,
    realEstateGains: amounts.realEstateGains,
    socialSecurity: tax.socialSecurity,
  })
}

/** Exact tax on the year's totals minus what was charged along the way (positive = still owed). */
export function taxTrueUp(tax: YearTax, amounts: TaxedAmounts): number {
  if (!tax.situation) return 0
  return totalTax(finalBase(tax, amounts), tax.situation) - amounts.charged
}

/** The federal deduction taken on the year's final totals (brackets only): standard, or itemized when larger. */
export function yearDeduction(tax: YearTax, amounts: Omit<TaxedAmounts, "charged">): { amount: number; itemized: boolean } | null {
  if (!tax.situation) return null
  const base = finalBase(tax, amounts)
  return federalDeduction(base, tax.situation, stateTax(base, tax.situation))
}
