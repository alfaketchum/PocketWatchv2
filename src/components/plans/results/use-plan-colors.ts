"use client"

import { useMemo } from "react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { CashFlowLayer, MilestoneGroup, NetWorthLayer } from "@/lib/plans/plan-chart"
import type { IncomeGroup } from "@/lib/plans/plan-chart-detail"

export interface PlanColors {
  netWorth: Record<NetWorthLayer | "debt", string>
  cashFlow: Record<CashFlowLayer, string>
  /** Income view bands, by kind of income. */
  income: Record<IncomeGroup, string>
  hub: string
  /** Up to four distinct plan lines (Compare). */
  series: string[]
  /** Loan payments in the Debt view: principal pays the loan down, interest is the cost of borrowing. */
  loan: { principal: string; interest: string }
  /** Milestone icons by what they're about. */
  milestones: Record<MilestoneGroup, string>
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
  // Stable between renders (only rebuilt when the theme changes), so charts can memoize on it.
  return useMemo(() => buildPlanColors({ primary, success, error, warning, card, foreground, accentHead }), [
    primary,
    success,
    error,
    warning,
    card,
    foreground,
    accentHead,
  ])
}

function buildPlanColors(t: {
  primary: string
  success: string
  error: string
  warning: string
  card: string
  foreground: string
  accentHead: string
}): PlanColors {
  const { primary, success, error, warning, card, foreground, accentHead } = t

  const netWorth: PlanColors["netWorth"] = {
    cash: accentHead,
    taxable: primary,
    taxDeferred: warning,
    taxFree: mix(primary, card, LIGHTER),
    // A lighter band of tax-free, so 529 money reads as tax-free but earmarked.
    taxFree529: mix(primary, card, 0.72),
    realAssets: mix(foreground, card, 0.75),
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
      assetSales: netWorth.realAssets,
      borrowed: mix(error, warning, 0.5),
      // Darker than spending's red so the gap reads differently from the spending it covers.
      unfunded: mix(error, foreground, 0.4),
      spending: error,
      taxes: mix(warning, card, LIGHTER),
      debtPayments: mix(error, card, LIGHTER),
      assetPurchases: netWorth.realAssets,
      saved: primary,
    },
    // Work green like money in; stock pay between it and the accent; retirement income gold and indigo; rent slate like property.
    income: {
      work: success,
      equity: mix(success, primary, 0.5),
      socialSecurity: primary,
      pension: warning,
      rental: accentHead,
      other: mix(foreground, card, 0.5),
    },
    hub: primary,
    loan: { principal: error, interest: warning },
    series: [primary, warning, accentHead, mix(primary, card, LIGHTER)],
    // Work life indigo, family green, school teal (between the two), money in gold, property slate (like its band), other changes dark neutral.
    milestones: { work: primary, family: success, education: mix(success, primary, 0.5), money: warning, property: accentHead, life: foreground, alert: error },
  }
}

/** How far the darkest and lightest subcategory shades move from their parent's color. */
const SHADE_DARKEST = 0.3
const SHADE_LIGHTEST = 0.55

/** `n` shades of `base` for subcategories: slightly darker through lighter, so neighbors stay distinct. */
export function shades(base: string, n: number, t: { card: string; foreground: string }): string[] {
  if (n <= 1) return [base]
  return Array.from({ length: n }, (_, i) => {
    const pos = -SHADE_DARKEST + ((SHADE_DARKEST + SHADE_LIGHTEST) * i) / (n - 1)
    return pos < 0 ? mix(base, t.foreground, -pos) : mix(base, t.card, pos)
  })
}
