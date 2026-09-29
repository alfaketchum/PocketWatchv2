/** Budget builder settings shared by client and server. */

import { getBudgetableCategories } from "@/lib/finance/categories"

/** Lookback windows (complete months) offered by the budget builder. */
export const BUDGET_LOOKBACK_OPTIONS = [6, 12, 18, 24, 36] as const
export type BudgetLookback = (typeof BUDGET_LOOKBACK_OPTIONS)[number]
export const DEFAULT_BUDGET_LOOKBACK: BudgetLookback = 12

export function isBudgetLookback(n: number): n is BudgetLookback {
  return (BUDGET_LOOKBACK_OPTIONS as readonly number[]).includes(n)
}

/**
 * A budget covers day-to-day lifestyle spending. Investments aren't spending, and taxes swing with (often
 * variable) income and are planned separately, so they're kept out of the builder.
 */
export const NON_LIFESTYLE_CATEGORIES = new Set(["Taxes", "Investment", "Crypto"])

export function isLifestyleCategory(category: string): boolean {
  return !NON_LIFESTYLE_CATEGORIES.has(category)
}

/** Categories the budget builder offers and the AI may budget. */
export function getLifestyleCategories(): string[] {
  return getBudgetableCategories().filter(isLifestyleCategory)
}
