"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { CompositionMode, CompositionResponse } from "@/types/composition"
import { portfolioFetch, portfolioKeys } from "./shared"

/** Stacked portfolio breakdown (Stablecoins vs Digital, or By asset) for a range. */
export function usePortfolioComposition(mode: CompositionMode | null, range: string) {
  return useQuery({
    queryKey: portfolioKeys.composition(mode ?? "none", range),
    queryFn: () => portfolioFetch<CompositionResponse>(`/history/composition?mode=${mode}&range=${range}`),
    enabled: mode !== null,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
}
