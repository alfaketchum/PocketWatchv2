/**
 * How each state's income tax treats a homeowner's property tax and mortgage interest (2025/2026):
 * whether it allows itemizing (and with what limits), a property-tax deduction or credit, and the
 * programs we don't model (senior / low-income relief, homestead exemptions on the bill itself).
 */

export interface StateHomeownerRules {
  /**
   * none: standard deduction / exemptions only. own: itemizing on the state return (property tax and
   * mortgage interest; state income tax isn't deductible). federal: taxable income starts from federal
   * taxable income, so the federal deduction flows through (less the state income tax in it).
   */
  itemize: "none" | "own" | "federal"
  /** The state lets you itemize only if you itemized on your federal return. */
  requiresFederalItemizing?: boolean
  caps?: { propertyTax?: number; mortgageAndPropertyTax?: number; total?: number }
  /** Mortgage debt whose interest counts (default: the federal $750,000). */
  mortgageDebtLimit?: number
  /** A deduction for property tax on your home, separate from itemizing. */
  propertyTaxDeduction?: { max: number }
  /** A credit of `rate` × property tax on your home, up to `max`, below an income limit. */
  propertyTaxCredit?: { rate: number; max?: number; incomeLimit?: { single: number; joint: number } }
  notModeled?: string
  source?: string
}

/** States without rules here are treated as `itemize: "none"` with no homeowner breaks. */
export const STATE_HOMEOWNER: Record<string, StateHomeownerRules> = {
  NJ: { itemize: "none", propertyTaxDeduction: { max: 15_000 }, notModeled: "Senior Freeze, ANCHOR and Stay NJ benefits" },
}
