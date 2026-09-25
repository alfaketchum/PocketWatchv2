"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { RoiResponse } from "@/types/roi"
import { portfolioFetch, portfolioKeys } from "./shared"

const REFRESHING_POLL_MS = 15_000

/** Per-token cost basis / PnL + Hyperliquid / Lighter positions. */
export function useRoi() {
  return useQuery({
    queryKey: portfolioKeys.roi(),
    queryFn: () => portfolioFetch<RoiResponse>("/roi"),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    // Poll only while the daily PnL refresh is running, to pick up its results
    refetchInterval: (query) => (query.state.data?.refreshing ? REFRESHING_POLL_MS : false),
  })
}
