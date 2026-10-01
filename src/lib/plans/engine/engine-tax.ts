import { inflationOf } from "../plan-inflation"
import { filingStatusAt, stateAt, taxRatesAt, type AdjustmentEntry } from "../plan-adjustments"
import { SOCIAL_SECURITY_TAXABLE_SHARE } from "../tax/federal-2026"
import { federalDeduction, marginalRates, stateTax, taxBase, thresholdIndex, totalTax, type TaxBase, type TaxSituation } from "../tax/tax-calc"
import type { Itemized } from "../tax/itemized-2026"
import type { PlanDocument } from "../plan-types"
import type { IncomeYear } from "./engine-flows"

export interface YearTax {
  /** The plan with this year's withdrawal tax rates (flat rates, or marginal rates under brackets). */
  doc: PlanDocument
  /** Set under brackets; null for flat rates. */
  situation: TaxSituation | null
  /** Tax on earned income (wages, pensions, taxable Social Security…). */
  incomeTax: number
  /** Ordinary taxable income before withdrawals, for the year-end true-up. */
  earnedOrdinary: number
}

/** Taxable earned income; under brackets only 85% of Social Security counts. */
function earnedOrdinaryIncome(doc: PlanDocument, income: IncomeYear, brackets: boolean): number {
  if (!brackets) return income.taxableIncome
  const exempt = doc.incomes
    .filter((i) => i.kind === "social_security" && i.taxable)
    .reduce((s, i) => s + (income.byId[i.id] ?? 0) * (1 - SOCIAL_SECURITY_TAXABLE_SHARE), 0)
  return Math.max(0, income.taxableIncome - exempt)
}

/**
 * How this year is taxed: flat rates (with any changes over time), or brackets for the year's status and state,
 * itemizing property tax and mortgage interest when that beats the standard deduction.
 */
export function yearTax(doc: PlanDocument, adjustments: AdjustmentEntry[], index: number, income: IncomeYear, itemized?: Itemized): YearTax {
  const settings = doc.settings
  if (settings.taxMode !== "brackets") {
    const rates = taxRatesAt(adjustments, settings, index)
    const yearDoc = adjustments.length ? { ...doc, settings: { ...settings, ...rates } } : doc
    return { doc: yearDoc, situation: null, incomeTax: income.taxableIncome * rates.incomeTaxRate, earnedOrdinary: income.taxableIncome }
  }
  const situation: TaxSituation = {
    status: filingStatusAt(adjustments, settings, index),
    state: stateAt(adjustments, settings, index),
    index: thresholdIndex(settings.startYear + index, inflationOf(settings), settings.startYear),
    ...(itemized ? { itemized } : {}),
  }
  const earnedOrdinary = earnedOrdinaryIncome(doc, income, true)
  const earned = taxBase({ ordinary: earnedOrdinary })
  const marginal = marginalRates(earned, situation)
  return {
    // Withdrawals are grossed up at these; short-term gains use the ordinary rate. The true-up settles the rest.
    doc: { ...doc, settings: { ...settings, incomeTaxRate: marginal.ordinary, capitalGainsRate: marginal.longGains } },
    situation,
    incomeTax: totalTax(earned, situation),
    earnedOrdinary,
  }
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
