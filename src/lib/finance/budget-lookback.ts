/** Lookback windows (complete months) offered by the budget builder. */
export const BUDGET_LOOKBACK_OPTIONS = [6, 12, 18, 24, 36] as const
export type BudgetLookback = (typeof BUDGET_LOOKBACK_OPTIONS)[number]
export const DEFAULT_BUDGET_LOOKBACK: BudgetLookback = 12

export function isBudgetLookback(n: number): n is BudgetLookback {
  return (BUDGET_LOOKBACK_OPTIONS as readonly number[]).includes(n)
}
