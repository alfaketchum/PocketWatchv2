"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { CompositionResponse, FinanceCompositionMode } from "@/types/composition"
import { financeFetch, financeKeys } from "./shared"

/** Stacked finance breakdown (by account group, or per account) for a range. */
export function useFinanceComposition(mode: FinanceCompositionMode | null, range: string, includeInvestments: boolean) {
  return useQuery({
    queryKey: financeKeys.composition(mode ?? "none", range, includeInvestments),
    queryFn: () => financeFetch<CompositionResponse<FinanceCompositionMode>>(
      `/composition?mode=${mode}&range=${range}&includeInvestments=${includeInvestments}`,
    ),
    enabled: mode !== null,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
}
