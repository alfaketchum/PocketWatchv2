/**
 * Budget builder hooks: AI-generated budget plans and whole-plan bulk save.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// The Claude CLI provider can take up to 180s server-side.
const GENERATE_TIMEOUT_MS = 200_000

export interface BudgetPlanProposal {
  summary: string
  categories: Array<{ category: string; amount: number; reason: string }>
}

export interface GeneratedBudgetPlan {
  proposal: BudgetPlanProposal
  monthsAnalyzed: number
  providerLabel: string
  generatedAt: string
}

export interface BudgetPlanSave {
  upsert: Array<{ category: string; monthlyLimit: number }>
  remove: string[]
}

export function useGenerateBudgetPlan() {
  return useMutation({
    mutationFn: ({ months, force }: { months: number; force?: boolean }) =>
      financeFetch<GeneratedBudgetPlan>(`/budgets/generate?months=${months}${force ? "&force=true" : ""}`, { method: "POST", timeoutMs: GENERATE_TIMEOUT_MS }),
  })
}

export function useSaveBudgetPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (plan: BudgetPlanSave) =>
      financeFetch<{ saved: number; removed: number }>("/budgets/bulk", { method: "PUT", body: JSON.stringify(plan) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.budgets() })
      qc.invalidateQueries({ queryKey: financeKeys.budgetAI() })
    },
  })
}
