"use client"

import { useQuery } from "@tanstack/react-query"
import type { MarketInflation } from "@/lib/plans/plan-types"
import { plansFetch, plansKeys } from "./shared"

const HOUR_MS = 60 * 60 * 1000

/** The bond market's expected inflation (TIPS breakevens from FRED), refreshed daily on the server. */
export function useMarketInflation(enabled = true) {
  return useQuery({
    queryKey: plansKeys.marketInflation(),
    queryFn: () => plansFetch<{ data: MarketInflation; fetchedAt: string }>("/market-inflation"),
    staleTime: HOUR_MS,
    enabled,
  })
}
