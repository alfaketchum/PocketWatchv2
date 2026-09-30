import {
  FEDERAL_LTCG,
  FEDERAL_ORDINARY,
  FEDERAL_STANDARD_DEDUCTION,
  TAX_BASE_YEAR,
  type Brackets,
  type FilingStatus,
} from "./federal-2026"
import { STATE_TAX } from "./state-2026"

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

/** Federal tax: ordinary income through the brackets, then gains stacked on top at 0 / 15 / 20%. */
export function federalTax(ordinary: number, gains: number, s: TaxSituation): number {
  const deduction = FEDERAL_STANDARD_DEDUCTION[s.status] * s.index
  const ordinaryTaxable = Math.max(0, ordinary - deduction)
  // Unused deduction shelters gains too.
  const gainsTaxable = Math.max(0, gains - Math.max(0, deduction - ordinary))
  const ltcg = FEDERAL_LTCG[s.status]
  const gainsTax = bracketTax(ordinaryTaxable + gainsTaxable, ltcg, s.index) - bracketTax(ordinaryTaxable, ltcg, s.index)
  return bracketTax(ordinaryTaxable, FEDERAL_ORDINARY[s.status], s.index) + gainsTax
}

/** State tax on all income (states tax gains like other income). */
export function stateTax(income: number, s: TaxSituation): number {
  const table = s.state ? STATE_TAX[s.state] : undefined
  if (!table || table.kind === "none") return 0
  const taxable = Math.max(0, income - (table.deduction?.[s.status] ?? 0) * s.index)
  if (table.kind === "flat") return taxable * (table.rate ?? 0)
  return table.brackets ? bracketTax(taxable, table.brackets[s.status], s.index) : 0
}

export function totalTax(ordinary: number, gains: number, s: TaxSituation): number {
  return federalTax(ordinary, gains, s) + stateTax(ordinary + gains, s)
}

/**
 * Marginal rates at this income, used to gross up withdrawals before the year's exact tax is known:
 * the next dollar of ordinary income, and the next dollar of long-term gains.
 */
export function marginalRates(ordinary: number, gains: number, s: TaxSituation): { ordinary: number; gains: number } {
  const step = 1_000
  const base = totalTax(ordinary, gains, s)
  return {
    ordinary: (totalTax(ordinary + step, gains, s) - base) / step,
    gains: (totalTax(ordinary, gains + step, s) - base) / step,
  }
}
