"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { NetWorthTf } from "@/hooks/use-net-worth-timeframe"

export interface CombinedNetWorthData {
  totalNetWorth: number
  fiat: {
    cash: number
    savings: number
    investments: number
    debt: number
    netWorth: number
  }
  crypto: {
    value: number
    stablecoins: number
    digitalAssets: number
    snapshotAt: string | null
  }
  history: Array<{
    date: string
    fiat: number
    crypto: number
    total: number
  }>
  /** Per-day totals for each asset/liability group (powers per-group change). */
  breakdownHistory?: Array<{
    date: string
    cash: number
    savings: number
    investment: number
    stablecoin: number
    digital: number
    credit: number
    loan: number
  }>
  /** Per-account balance change over each timeframe window. */
  accountChanges?: Record<string, Partial<Record<NetWorthTf, number>>>
}

/** "year" = last 365 days of history (default); "all" = full history. */
export type NetWorthHistoryRange = "year" | "all"

async function fetchCombinedNetWorth(range: NetWorthHistoryRange): Promise<CombinedNetWorthData> {
  const res = await fetch(`/api/net-worth${range === "all" ? "?range=all" : ""}`, { credentials: "include" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export const combinedNetWorthKeys = {
  all: ["combined-net-worth"] as const,
  summary: (range: NetWorthHistoryRange = "year") => [...combinedNetWorthKeys.all, "summary", range] as const,
}

export function useCombinedNetWorth(range: NetWorthHistoryRange = "year") {
  return useQuery({
    queryKey: combinedNetWorthKeys.summary(range),
    queryFn: () => fetchCombinedNetWorth(range),
    staleTime: 2 * 60_000,
    // Switching range keeps the current chart on screen while the other loads
    placeholderData: keepPreviousData,
  })
}
