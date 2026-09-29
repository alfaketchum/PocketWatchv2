"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { financeKeys } from "./shared"
import { useFinanceTrends } from "./use-insights"
import { useFinanceIncome } from "./use-settings"
import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { buildBaseline } from "@/lib/fire/fire-plan"
import { parseDataset } from "@/lib/fire/swr-simulation"
import type { FireBaseline, MarketHistory, ShillerDataset } from "@/lib/fire/fire-types"

/** 12 complete months plus the current partial month (which the baseline drops). */
const TREND_MONTHS = 13

/** Auto-fill values for the FIRE planner, derived from net worth, spending and income. */
export function useFireBaseline(): { baseline: FireBaseline; isLoading: boolean } {
  const netWorth = useCombinedNetWorth("year")
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

  return { baseline, isLoading: netWorth.isLoading || trends.isLoading }
}

/** Bundled Shiller history (1871–present), loaded on demand and parsed once. */
export function useFireHistoryData() {
  return useQuery<MarketHistory>({
    queryKey: financeKeys.fireHistory(),
    queryFn: async () => {
      const mod = await import("@/lib/fire/data/shiller-monthly.json")
      return parseDataset(mod.default as ShillerDataset)
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
