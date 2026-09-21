/**
 * Budget CRUD and AI suggestion hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

interface BudgetWithSpending {
  id: string
  userId: string
  category: string
  /** For a lookback window this is the pro-rated period target; for the default
   *  month view it's the raw monthly target. */
  monthlyLimit: number
  /** The raw stored monthly target (unscaled) — present on lookback responses. */
  baseMonthlyLimit?: number
  rollover: boolean
  isActive: boolean
  spent: number
  remaining: number
  percentUsed: number
}

/** Optional lookback window for budget spending (ISO YYYY-MM-DD). */
export interface BudgetRangeParam {
  startDate: string
  endDate: string
}

interface BudgetSuggestion {
  category: string
  avgMonthly: number
  lastMonth: number
  monthsOfData: number
  suggested: number
}

interface BudgetSuggestionsData {
  suggestions: BudgetSuggestion[]
  monthsAnalyzed: number
  totalAvgSpending: number
}

interface BudgetAICategoryAnalysis {
  category: string
  verdict: "under-budgeted" | "over-budgeted" | "well-aligned" | "missing"
  comment: string
  priority: "high" | "medium" | "low"
}

interface BudgetAIAnalysis {
  overallScore: number
  overallVerdict: string
  categoryAnalysis: BudgetAICategoryAnalysis[]
  recommendations: Array<{ action: string; impact: "high" | "medium" | "low" }>
  missingBudgets: Array<{ category: string; reason: string }>
}

interface BudgetAIData {
  available: boolean
  hasProvider?: boolean
  providerLabel?: string | null
  analysis?: BudgetAIAnalysis
  provider?: string
  generatedAt?: string
}

// ─── Budget Hooks ───────────────────────────────────────────────

export function useFinanceBudgets(range?: BudgetRangeParam) {
  const qs = range ? `?startDate=${range.startDate}&endDate=${range.endDate}` : ""
  const rangeKey = range ? `${range.startDate}_${range.endDate}` : undefined
  return useQuery({
    queryKey: financeKeys.budgets(rangeKey),
    queryFn: () => financeFetch<BudgetWithSpending[]>(`/budgets${qs}`),
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { category: string; monthlyLimit: number; rollover?: boolean }) =>
      financeFetch("/budgets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.budgets() }),
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      budgetId: string
      monthlyLimit?: number
      rollover?: boolean
      isActive?: boolean
    }) => financeFetch("/budgets", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.budgets() }),
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (budgetId: string) =>
      financeFetch(`/budgets?budgetId=${budgetId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.budgets() }),
  })
}

// ─── Budget Suggestions Hook ────────────────────────────────────

export function useBudgetSuggestions() {
  return useQuery({
    queryKey: financeKeys.budgetSuggestions(),
    queryFn: () => financeFetch<BudgetSuggestionsData>("/budgets/suggest"),
  })
}

// ─── Budget AI Analysis Hook ────────────────────────────────────

export function useBudgetAI() {
  return useQuery({
    queryKey: financeKeys.budgetAI(),
    queryFn: () => financeFetch<BudgetAIData>("/budgets/insights"),
  })
}

export function useGenerateBudgetAI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts?: { force?: boolean }) =>
      financeFetch<BudgetAIData>(`/budgets/insights${opts?.force ? "?force=true" : ""}`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.budgetAI() }),
  })
}
