"use client"

import { useQuery } from "@tanstack/react-query"
import type { TradingActivity } from "@/lib/plans/trading-detect"
import { plansFetch, plansKeys } from "./shared"

/** Trading activity of the user's linked brokerage accounts (by finance account id). */
export function useTradingActivity() {
  return useQuery({
    queryKey: plansKeys.tradingActivity(),
    queryFn: () => plansFetch<{ activity: Record<string, TradingActivity> }>("/trading-activity").then((r) => r.activity),
    staleTime: 10 * 60_000,
  })
}
