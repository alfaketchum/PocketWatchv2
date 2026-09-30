"use client"

import { useChartTheme } from "@/hooks/use-chart-theme"
import type { CashFlowLayer, NetWorthLayer } from "@/lib/plans/plan-chart"

export interface PlanColors {
  netWorth: Record<NetWorthLayer | "debt", string>
  cashFlow: Record<CashFlowLayer, string>
  hub: string
}

/** Theme colors for the plan charts, shared so a flow looks the same in every view. */
export function usePlanColors(): PlanColors {
  const { primary, palette, error, foregroundMuted, warning, success } = useChartTheme()
  const netWorth: PlanColors["netWorth"] = {
    cash: palette[2] ?? success,
    taxable: primary,
    taxDeferred: palette[1] ?? warning,
    taxFree: palette[3] ?? primary,
    realAssetEquity: foregroundMuted,
    debt: error,
  }
  return {
    netWorth,
    cashFlow: {
      income: success,
      wdCash: netWorth.cash,
      wdTaxable: netWorth.taxable,
      wdTaxDeferred: netWorth.taxDeferred,
      wdTaxFree: netWorth.taxFree,
      assetSales: foregroundMuted,
      unfunded: error,
      spending: palette[4] ?? error,
      taxes: warning,
      debtPayments: palette[5] ?? primary,
      assetPurchases: foregroundMuted,
      saved: palette[7] ?? success,
    },
    hub: primary,
  }
}
