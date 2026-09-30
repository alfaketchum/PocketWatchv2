import {
  FEDERAL_LTCG,
  FEDERAL_ORDINARY,
  FEDERAL_STANDARD_DEDUCTION,
  NIIT_RATE,
  NIIT_THRESHOLD,
  TAX_BASE_YEAR,
  type Brackets,
  type FilingStatus,
} from "./federal-2026"
import { STATE_GAINS } from "./state-gains-2026"
import { STATE_TAX, type StateTax } from "./state-2026"

/** Tax on `income` over progressive `brackets` whose thresholds are scaled by `index`. */
export function bracketTax(income: number, brackets: Brackets, index = 1): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const lower = brackets[i][0] * index
    const upper = i + 1 < brackets.length ? brackets[i + 1][0] * index : Infinity
    if (income <= lower) break
    tax += (Math.min(income, upper) - lower) * brackets[i][1]
  }
  return tax
}

/** Rate on the next dollar of `income`. */
export function marginalRate(income: number, brackets: Brackets, index = 1): number {
  let rate = brackets[0]?.[1] ?? 0
  for (const [threshold, r] of brackets) if (income >= threshold * index) rate = r
  return rate
}

/** Inflation index for tax thresholds in `year` (2026 dollars → that year's dollars). */
export function thresholdIndex(year: number, inflation: number): number {
  return Math.pow(1 + inflation, year - TAX_BASE_YEAR)
}

export interface TaxSituation {
  status: FilingStatus
  /** Two-letter state code, or null for no state income tax. */
  state: string | null
  /** Threshold index for the year (see thresholdIndex). */
  index: number
}

/** A year's taxable income by kind. */
export interface TaxBase {
  /** Wages, pensions, traditional withdrawals, taxable Social Security… */
  ordinary: number
  /** Gains on things held a year or less: taxed as ordinary income. */
  shortGains: number
  /** Gains on things held over a year (after the home-sale exclusion). */
  longGains: number
  /** The part of `longGains` from real estate (some state rules treat it differently). */
  realEstateGains: number
}

export function taxBase(part: Partial<TaxBase>): TaxBase {
  return { ordinary: 0, shortGains: 0, longGains: 0, realEstateGains: 0, ...part }
}

/** 3.8% on investment income (all gains) above the MAGI line. */
function netInvestmentIncomeTax(b: TaxBase, s: TaxSituation): number {
  const investment = b.shortGains + b.longGains
  const over = b.ordinary + investment - NIIT_THRESHOLD[s.status]
  return NIIT_RATE * Math.max(0, Math.min(investment, over))
}

/**
 * Federal tax: ordinary income and short-term gains through the brackets, then long-term gains
 * stacked on top at 0 / 15 / 20%, plus the 3.8% net investment income tax.
 */
export function federalTax(b: TaxBase, s: TaxSituation): number {
  const ordinary = b.ordinary + b.shortGains
  const deduction = FEDERAL_STANDARD_DEDUCTION[s.status] * s.index
  const ordinaryTaxable = Math.max(0, ordinary - deduction)
  // Unused deduction shelters gains too.
  const gainsTaxable = Math.max(0, b.longGains - Math.max(0, deduction - ordinary))
  const ltcg = FEDERAL_LTCG[s.status]
  const gainsTax = bracketTax(ordinaryTaxable + gainsTaxable, ltcg, s.index) - bracketTax(ordinaryTaxable, ltcg, s.index)
  return bracketTax(ordinaryTaxable, FEDERAL_ORDINARY[s.status], s.index) + gainsTax + netInvestmentIncomeTax(b, s)
}

/** The state's regular income tax on `income`. */
function regularStateTax(table: StateTax | undefined, income: number, s: TaxSituation): number {
  if (!table || table.kind === "none") return 0
  const taxable = Math.max(0, income - (table.deduction?.[s.status] ?? 0) * s.index)
  if (table.kind === "flat") return taxable * (table.rate ?? 0)
  return table.brackets ? bracketTax(taxable, table.brackets[s.status], s.index) : 0
}

/** Montana-style: long-term gains on their own brackets, stacked on other taxable income. */
function separateGainsTax(table: StateTax | undefined, b: TaxBase, s: TaxSituation, brackets: Brackets): number {
  const other = b.ordinary + b.shortGains
  const deduction = (table?.deduction?.[s.status] ?? 0) * s.index
  const otherTaxable = Math.max(0, other - deduction)
  const gainsTaxable = Math.max(0, b.longGains - Math.max(0, deduction - other))
  return regularStateTax(table, other, s) + bracketTax(otherTaxable + gainsTaxable, brackets, s.index) - bracketTax(otherTaxable, brackets, s.index)
}

/** State tax: gains are taxed like other income, except in the states in STATE_GAINS. */
export function stateTax(b: TaxBase, s: TaxSituation): number {
  const table = s.state ? STATE_TAX[s.state] : undefined
  const rule = s.state ? STATE_GAINS[s.state] : undefined
  const all = b.ordinary + b.shortGains + b.longGains
  if (!rule) return regularStateTax(table, all, s)
  switch (rule.kind) {
    case "exclude":
      return regularStateTax(table, all - b.longGains * rule.share, s)
    case "deduct":
      return regularStateTax(table, all - Math.min(b.longGains, rule.amount), s)
    case "maxRate":
      return Math.min(regularStateTax(table, all, s), regularStateTax(table, all - b.longGains, s) + b.longGains * rule.rate)
    case "separate":
      return separateGainsTax(table, b, s, rule.brackets[s.status])
    case "shortSurcharge":
      return regularStateTax(table, all, s) + b.shortGains * rule.extra
    case "gainsOnly":
      return bracketTax(Math.max(0, b.longGains - b.realEstateGains - rule.deduction * s.index), rule.brackets, s.index)
  }
}

export function totalTax(b: TaxBase, s: TaxSituation): number {
  return federalTax(b, s) + stateTax(b, s)
}

export interface MarginalRates {
  ordinary: number
  shortGains: number
  longGains: number
}

/**
 * Marginal rates at this income, used to gross up withdrawals before the year's exact tax is known:
 * the next dollar of ordinary income, of short-term gains and of long-term gains.
 */
export function marginalRates(b: TaxBase, s: TaxSituation): MarginalRates {
  const step = 1_000
  const base = totalTax(b, s)
  const next = (change: Partial<TaxBase>) => (totalTax({ ...b, ...change }, s) - base) / step
  return {
    ordinary: next({ ordinary: b.ordinary + step }),
    shortGains: next({ shortGains: b.shortGains + step }),
    longGains: next({ longGains: b.longGains + step }),
  }
}
