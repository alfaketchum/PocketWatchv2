"use client"

import { useChartTheme } from "@/hooks/use-chart-theme"
import type { CashFlowLayer, NetWorthLayer } from "@/lib/plans/plan-chart"

export interface PlanColors {
  netWorth: Record<NetWorthLayer | "debt", string>
  cashFlow: Record<CashFlowLayer, string>
  hub: string
  /** Up to four distinct plan lines (Compare). */
  series: string[]
}

const HEX = /^#([0-9a-f]{6})$/i

/** Blend `color` toward `base` (0 = color, 1 = base). Non-hex values pass through unchanged. */
function mix(color: string, base: string, amount: number): string {
  const a = HEX.exec(color.trim())
  const b = HEX.exec(base.trim())
  if (!a || !b) return color
  const channel = (i: number) => {
    const from = parseInt(a[1].slice(i, i + 2), 16)
    const to = parseInt(b[1].slice(i, i + 2), 16)
    return Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

const LIGHTER = 0.5

/**
 * Plan chart colors built only from the theme's tokens: the indigo accent, amber, the neutral
 * accent, and green/red for money in and out. Extra shades are the same tokens blended toward the
 * card surface, so every color follows light/dark mode.
 */
export function usePlanColors(): PlanColors {
  const { primary, success, error, warning, card, foreground, accentHead } = useChartTheme()
  const netWorth: PlanColors["netWorth"] = {
    cash: accentHead,
    taxable: primary,
    taxDeferred: warning,
    taxFree: mix(primary, card, LIGHTER),
    realAssetEquity: mix(foreground, card, 0.75),
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
      assetSales: netWorth.realAssetEquity,
      unfunded: error,
      spending: error,
      taxes: mix(warning, card, LIGHTER),
      debtPayments: mix(error, card, LIGHTER),
      assetPurchases: netWorth.realAssetEquity,
      saved: primary,
    },
    hub: primary,
    series: [primary, warning, accentHead, mix(primary, card, LIGHTER)],
  }
}
