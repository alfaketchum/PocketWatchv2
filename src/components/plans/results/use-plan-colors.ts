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

/** [r, g, b] from #rgb, #rrggbb or rgb()/rgba(); null for anything else. */
function parseColor(value: string): [number, number, number] | null {
  const v = value.trim()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v)
  if (short) return [short[1], short[2], short[3]].map((c) => parseInt(c + c, 16)) as [number, number, number]
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v)
  if (long) return [long[1], long[2], long[3]].map((c) => parseInt(c, 16)) as [number, number, number]
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

/** Blend `color` toward `base` (0 = color, 1 = base). Unparseable values pass through unchanged. */
export function mix(color: string, base: string, amount: number): string {
  const a = parseColor(color)
  const b = parseColor(base)
  if (!a || !b) return color
  const hex = a.map((from, i) => Math.round(from + (b[i] - from) * amount).toString(16).padStart(2, "0"))
  return `#${hex.join("")}`
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
    // A lighter band of tax-free, so 529 money reads as tax-free but earmarked.
    taxFree529: mix(primary, card, 0.72),
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
      wdTaxFree529: netWorth.taxFree529,
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
