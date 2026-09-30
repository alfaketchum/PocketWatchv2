import { filingStatusAt, taxRatesAt, type AdjustmentEntry } from "../plan-adjustments"
import { SOCIAL_SECURITY_TAXABLE_SHARE } from "../tax/federal-2026"
import { marginalRates, thresholdIndex, totalTax, type TaxSituation } from "../tax/tax-calc"
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

/** How this year is taxed: flat rates (with any changes over time), or brackets for the year's status and state. */
export function yearTax(doc: PlanDocument, adjustments: AdjustmentEntry[], index: number, income: IncomeYear): YearTax {
  const settings = doc.settings
  if (settings.taxMode !== "brackets") {
    const rates = taxRatesAt(adjustments, settings, index)
    const yearDoc = adjustments.length ? { ...doc, settings: { ...settings, ...rates } } : doc
    return { doc: yearDoc, situation: null, incomeTax: income.taxableIncome * rates.incomeTaxRate, earnedOrdinary: income.taxableIncome }
  }
  const situation: TaxSituation = {
    status: filingStatusAt(adjustments, settings, index),
    state: settings.state,
    index: thresholdIndex(settings.startYear + index, settings.inflation),
  }
  const earnedOrdinary = earnedOrdinaryIncome(doc, income, true)
  const marginal = marginalRates(earnedOrdinary, 0, situation)
  return {
    doc: { ...doc, settings: { ...settings, incomeTaxRate: marginal.ordinary, capitalGainsRate: marginal.gains } },
    situation,
    incomeTax: totalTax(earnedOrdinary, 0, situation),
    earnedOrdinary,
  }
}

export interface TaxedAmounts {
  /** Ordinary income from withdrawals (traditional accounts, inherited IRAs). */
  ordinaryWithdrawn: number
  /** Realized gains from taxable withdrawals and asset sales. */
  gains: number
  /** Tax already charged this year. */
  charged: number
}

/** Exact tax on the year's totals minus what was charged along the way (positive = still owed). */
export function taxTrueUp(tax: YearTax, amounts: TaxedAmounts): number {
  if (!tax.situation) return 0
  return totalTax(tax.earnedOrdinary + amounts.ordinaryWithdrawn, amounts.gains, tax.situation) - amounts.charged
}
