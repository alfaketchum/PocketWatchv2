"use client"

import { useQuery } from "@tanstack/react-query"
import type { SourceBalances } from "@/lib/plans/plan-refresh"
import type { SpendingBasis } from "@/lib/plans/import/import-mapping"
import type { PlanDocument, PlanExpense } from "@/lib/plans/plan-types"
import { plansFetch, plansKeys } from "./shared"

export interface ImportDraftResponse {
  document: PlanDocument
  /** Spending measured each way: 12-month average, typical (median) month, or budgets. */
  spending: Record<SpendingBasis, PlanExpense[]>
  budgetedCategories: string[]
  uncheckedIds: string[]
}

export type SourceBalancesResponse = SourceBalances

/** Draft plan from the user's linked data; only fetched while the import dialog is open. */
export function usePlanImportPreview(enabled: boolean) {
  return useQuery({
    queryKey: plansKeys.importPreview(),
    queryFn: () => plansFetch<ImportDraftResponse>("/import-preview", { timeoutMs: 90_000 }),
    enabled,
    staleTime: 60_000,
  })
}

/** Fetch current balances of linked accounts on demand ("Refresh balances"). */
export function fetchSourceBalances(): Promise<SourceBalancesResponse> {
  return plansFetch<SourceBalancesResponse>("/source-balances", { timeoutMs: 90_000 })
}

export interface StockPrice {
  symbol: string
  price: number
}

/** The latest price of one stock (RSUs and options); only on request. */
export function fetchStockPrice(symbol: string): Promise<StockPrice> {
  return plansFetch<StockPrice>(`/stock-price?symbol=${encodeURIComponent(symbol)}`)
}
