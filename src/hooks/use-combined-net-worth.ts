"use client"

import { useQuery } from "@tanstack/react-query"

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
  /** Per-day Cash/Investments/Credit/Loans totals (from snapshot breakdown). */
  breakdownHistory?: Array<{
    date: string
    cash: number
    investment: number
    credit: number
    loan: number
  }>
  /** Per-account balance change over the W / M / Y windows. */
  accountChanges?: Record<string, { W: number; M: number; Y: number }>
}

async function fetchCombinedNetWorth(): Promise<CombinedNetWorthData> {
  const res = await fetch("/api/net-worth", { credentials: "include" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export const combinedNetWorthKeys = {
  all: ["combined-net-worth"] as const,
  summary: () => [...combinedNetWorthKeys.all, "summary"] as const,
}

export function useCombinedNetWorth() {
  return useQuery({
    queryKey: combinedNetWorthKeys.summary(),
    queryFn: fetchCombinedNetWorth,
    staleTime: 2 * 60_000,
  })
}
