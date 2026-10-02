import type { Inflation } from "../plan-inflation"
import { filingStatusAt, stateAt, taxRatesAt, type AdjustmentEntry } from "../plan-adjustments"
import {
  federalDeduction,
  seniorDeduction,
  marginalRates,
  minimumTax,
  stateTax,
  taxBase,
  thresholdIndex,
  totalTax,
  type MinimumTax,
  type TaxBase,
  type TaxSituation,
} from "../tax/tax-calc"
import type { Itemized } from "../tax/itemized-2026"
import type { PlanDocument, PlanIncome } from "../plan-types"
import type { IncomeEntry, IncomeYear } from "./engine-flows"
import { payrollTax, type PayrollTax } from "../tax/payroll-2026"
import { paysWages } from "../plan-constants"

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
  /** ISO gains kept: only the AMT counts them. */
  amtPreference: number
}

/** Age that earns the extra standard deduction and the senior deduction (65 by the end of the tax year). */
const SENIOR_AGE = 65

/** Filers 65 or older in `year`: on a joint return each person in the plan, filing single only you (the first person). */
function seniorFilers(doc: PlanDocument, status: "single" | "joint", year: number): number {
  const filers = status === "joint" ? doc.people.slice(0, 2) : doc.people.slice(0, 1)
  return filers.filter((p) => year - p.birthYear >= SENIOR_AGE).length
}

/** Social Security benefits this year (the taxable part is worked out with the rest of the year's income). */
function socialSecurityReceived(doc: PlanDocument, income: IncomeYear): number {
  return doc.incomes.filter((i) => i.kind === "social_security" && i.taxable).reduce((s, i) => s + (income.byId[i.id] ?? 0), 0)
}

/**
 * How this year is taxed: flat rates (with any changes over time), or brackets for the year's status and state,
 * itemizing property tax and mortgage interest when that beats the standard deduction. `amtCredit` is the minimum
 * tax credit carried in from earlier ISO years (brackets only; flat rates have no AMT).
 */
export function yearTax(
  doc: PlanDocument,
  adjustments: AdjustmentEntry[],
  index: number,
  income: IncomeYear,
  inflation: Inflation,
  itemized?: Itemized,
  amtCredit = 0,
): YearTax {
  const settings = doc.settings
  if (settings.taxMode !== "brackets") {
    const rates = taxRatesAt(adjustments, settings, index)
    const yearDoc = adjustments.length ? { ...doc, settings: { ...settings, ...rates } } : doc
    return { doc: yearDoc, situation: null, incomeTax: income.taxableIncome * rates.incomeTaxRate, earnedOrdinary: income.taxableIncome, socialSecurity: 0, amtPreference: 0 }
  }
  const status = filingStatusAt(adjustments, settings, index)
  const year = settings.startYear + index
  const seniors = seniorFilers(doc, status, year)
  const situation: TaxSituation = {
    status,
    state: stateAt(adjustments, settings, index),
    index: thresholdIndex(year, inflation, settings.startYear),
    year,
    ...(seniors > 0 ? { seniors } : {}),
    ...(itemized ? { itemized } : {}),
    ...(amtCredit > 0 ? { amtCredit } : {}),
  }
  const socialSecurity = socialSecurityReceived(doc, income)
  const earnedOrdinary = Math.max(0, income.taxableIncome - socialSecurity)
  const earned = taxBase({ ordinary: earnedOrdinary, socialSecurity, amtPreference: income.amtPreference })
  const marginal = marginalRates(earned, situation)
  return {
    // Withdrawals are grossed up at these; short-term gains use the ordinary rate. The true-up settles the rest.
    doc: { ...doc, settings: { ...settings, incomeTaxRate: marginal.ordinary, capitalGainsRate: marginal.longGains } },
    situation,
    incomeTax: totalTax(earned, situation),
    earnedOrdinary,
    socialSecurity,
    amtPreference: income.amtPreference,
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
  const amounts = (counts: (i: PlanIncome) => boolean) =>
    entries.filter((e) => counts(e.income) && e.income.taxable).map((e) => income.byId[e.income.id] ?? 0).filter((v) => v > 0)
  const { settings } = doc
  return payrollTax(amounts(paysWages), amounts((i) => i.kind === "business"), filingStatusAt(adjustments, settings, index), thresholdIndex(settings.startYear + index, inflation, settings.startYear))
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
    amtPreference: tax.amtPreference,
  })
}

/** Exact tax on the year's totals minus what was charged along the way (positive = still owed). */
export function taxTrueUp(tax: YearTax, amounts: TaxedAmounts): number {
  if (!tax.situation) return 0
  return totalTax(finalBase(tax, amounts), tax.situation) - amounts.charged
}

/** A year's income tax (federal + state) split by the kind of income it falls on. */
export interface TaxKinds {
  /** Wages, pensions, rent, taxable Social Security, 401(k)/IRA withdrawals. */
  ordinary: number
  /** Gains on things held a year or less (taxed at income rates, stacked on top of ordinary income). */
  shortGains: number
  /** Gains on things held over a year (0 / 15 / 20%, plus the 3.8% investment-income tax where it reaches them). */
  longGains: number
  /** Tax on earned income alone: what comes off a paycheck-style "take-home". */
  earnedOnly: number
}

/**
 * Split `paid` (the year's income tax actually paid: what was charged along the way plus the true-up) by kind of
 * income, stacked the way the tax law does: ordinary income first, short-term gains on top, long-term gains last.
 * Under brackets each layer is the exact extra tax it adds; the last layer takes the rounding so the kinds sum to `paid`.
 */
export function taxesByKind(tax: YearTax, amounts: Omit<TaxedAmounts, "charged">, paid: number): TaxKinds {
  if (!tax.situation) {
    const { incomeTaxRate, capitalGainsRate } = tax.doc.settings
    const shortGains = amounts.shortGains * incomeTaxRate
    const longGains = amounts.longGains * capitalGainsRate
    return { ordinary: paid - shortGains - longGains, shortGains, longGains, earnedOnly: tax.incomeTax }
  }
  const base = finalBase(tax, amounts)
  const situation = tax.situation
  const without = (part: Partial<TaxBase>) => totalTax({ ...base, ...part }, situation)
  const noGains = { shortGains: 0, longGains: 0, realEstateGains: 0 }
  const ordinary = without(noGains)
  const withShort = without({ longGains: 0, realEstateGains: 0 })
  return {
    ordinary,
    shortGains: withShort - ordinary,
    longGains: paid - withShort,
    earnedOnly: without({ ...noGains, ordinary: tax.earnedOrdinary }),
  }
}

/** The federal deduction taken on the year's final totals (brackets only): standard, or itemized when larger. */
export function yearDeduction(tax: YearTax, amounts: Omit<TaxedAmounts, "charged">): { amount: number; itemized: boolean; senior: number } | null {
  if (!tax.situation) return null
  const base = finalBase(tax, amounts)
  return { ...federalDeduction(base, tax.situation, stateTax(base, tax.situation)), senior: seniorDeduction(base, tax.situation) }
}

/** The year's AMT and minimum tax credit on its final totals (brackets only; null for flat rates). */
export function yearMinimumTax(tax: YearTax, amounts: Omit<TaxedAmounts, "charged">): MinimumTax | null {
  if (!tax.situation) return null
  const base = finalBase(tax, amounts)
  return minimumTax(base, tax.situation, stateTax(base, tax.situation))
}
