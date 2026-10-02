"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { financeKeys } from "./shared"
import { useFinanceTrends } from "./use-insights"
import { useFinanceIncome } from "./use-settings"
import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { buildBaseline } from "@/lib/fire/fire-plan"
import { parseDataset } from "@/lib/fire/swr-simulation"
import type { MarketHistory, ShillerDataset } from "@/lib/fire/fire-types"

/** 12 complete months plus the current partial month (which the baseline drops). */
const TREND_MONTHS = 13

/**
 * Auto-fill values for the FIRE planner, derived from net worth, spending and income.
 * Also returns the raw net-worth and trend data so the plan can chart history and
 * category costs without refetching.
 */
export function useFireBaseline() {
  const netWorth = useCombinedNetWorth("all")
  const trends = useFinanceTrends(TREND_MONTHS)
  const income = useFinanceIncome()

  const baseline = useMemo(
    () =>
      buildBaseline(
        netWorth.data,
        trends.data?.months ?? [],
        income.data?.override ?? null,
        new Date().toISOString().slice(0, 7),
      ),
    [netWorth.data, trends.data, income.data],
  )

  return {
    baseline,
    netWorth: netWorth.data,
    trendMonths: trends.data?.months ?? [],
    isLoading: netWorth.isLoading || trends.isLoading,
  }
}

/** Bundled Shiller history (1871–present), loaded on demand and parsed once (only while `enabled`). */
export function useFireHistoryData(enabled = true) {
  return useQuery<MarketHistory>({
    enabled,
    queryKey: financeKeys.fireHistory(),
    queryFn: async () => {
      const mod = await import("@/lib/fire/data/shiller-monthly.json")
      return parseDataset(mod.default as ShillerDataset)
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
