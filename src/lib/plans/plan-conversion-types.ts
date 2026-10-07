import type { Timing } from "./plan-types"

/**
 * How much a Roth conversion rule moves each year:
 * - fixed: a set amount (gross, before any withholding), in today's dollars or in each year's dollars
 * - bracket: fill federal taxable ordinary income to the top of the bracket at this rate
 * - targetIncome: fill federal taxable income to this amount (today's dollars)
 * - convertAll: spread what's left evenly over the remaining years, so the sources are empty by `end`
 */
export type ConversionMode =
  | { mode: "fixed"; amount: number; amountBasis: "today" | "nominal" }
  | { mode: "bracket"; bracketRate: number }
  | { mode: "targetIncome"; targetIncome: number }
  | { mode: "convertAll" }

/** Limits on top of the mode; the tightest wins. */
export interface ConversionCaps {
  /** Keep MAGI under the start of the next Medicare IRMAA tier (0 = no surcharge) from age 63 (2-year lookback). */
  irmaaTier?: number | null
  /** Don't push long-term gains out of the 0% bracket. */
  keepLtcgZero?: boolean
}

/** Moves money from traditional accounts to a Roth account every year in [start, end). */
export type PlanConversion = ConversionMode & {
  id: string
  name: string
  start: Timing
  end: Timing
  /** The owner's traditional accounts, drawn pro rata. */
  sourceAccountIds: string[]
  /** A Roth account with the same owner. */
  destAccountId: string
  caps: ConversionCaps
  /** cashFlow: the tax comes out of the year's cash flow. withhold: it's taken from the conversion (less reaches the Roth). */
  payTaxFrom: "cashFlow" | "withhold"
  /** The milestone or tool that created this ("roth-optimizer"). */
  origin?: string
}
