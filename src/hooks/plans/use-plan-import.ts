"use client"

import { useQuery } from "@tanstack/react-query"
import type { SourceBalances } from "@/lib/plans/plan-refresh"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { plansFetch, plansKeys } from "./shared"

export interface ImportDraftResponse {
  document: PlanDocument
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
