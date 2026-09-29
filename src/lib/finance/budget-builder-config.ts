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

// ─── Income profile ─────────────────────────────────────────────
// Steady (paycheck-like) income shapes a budget: stay within it, leave room to
// save. Variable income (e.g. investment returns) is context only.

const STEADY_MIN_MONTH_COVERAGE = 0.8
const STEADY_MAX_VARIATION = 0.35
const STEADY_MIN_SPEND_COVERAGE = 0.8

export type IncomeProfile =
  | { kind: "steady"; monthly: number; source: "override" | "detected" }
  | { kind: "variable"; monthly: number }

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * A user-entered monthly income is always steady. Otherwise income is steady
 * when it arrives in most months, varies little, and covers typical spending.
 */
export function classifyIncome(monthlyIncome: number[], typicalSpend: number, override: number | null): IncomeProfile {
  if (override != null && override > 0) return { kind: "steady", monthly: override, source: "override" }
  const n = monthlyIncome.length
  const median = medianOf(monthlyIncome)
  if (n === 0 || median <= 0) return { kind: "variable", monthly: 0 }
  const mean = monthlyIncome.reduce((s, v) => s + v, 0) / n
  const stdev = Math.sqrt(monthlyIncome.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  const steady =
    monthlyIncome.filter((v) => v > 0).length / n >= STEADY_MIN_MONTH_COVERAGE &&
    stdev / mean <= STEADY_MAX_VARIATION &&
    median >= typicalSpend * STEADY_MIN_SPEND_COVERAGE
  return steady ? { kind: "steady", monthly: Math.round(median), source: "detected" } : { kind: "variable", monthly: Math.round(mean) }
}
