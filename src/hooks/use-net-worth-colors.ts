"use client"

import { useChartTheme } from "@/hooks/use-chart-theme"

export type NwCategory = "cash" | "savings" | "investment" | "stablecoin" | "digital" | "realEstate" | "vehicle" | "otherAsset" | "debt"

/** Asset categories in stack order (bottom → top). Debt is a liability, shown separately. */
export const NW_STACK_ORDER: Exclude<NwCategory, "debt">[] = [
  "cash", "savings", "investment", "stablecoin", "digital", "realEstate", "vehicle", "otherAsset",
]

export interface NwCategoryMeta {
  key: NwCategory
  label: string
  icon: string
  color: string
}

/**
 * Net-worth category metadata with theme-resolved colors, so the chart uses our
 * Mercury palette (adapts to light/dark) instead of hardcoded hues.
 */
export function useNetWorthCategories(): Record<NwCategory, NwCategoryMeta> {
  const ct = useChartTheme()
  return {
    cash:       { key: "cash",       label: "Cash",          icon: "account_balance",        color: ct.success },
    savings:    { key: "savings",    label: "Savings",       icon: "savings",                color: ct.palette[5] ?? "#5AC8FA" },
    investment: { key: "investment", label: "Investments",   icon: "trending_up",            color: ct.primary },
    stablecoin: { key: "stablecoin", label: "Stablecoins",   icon: "paid",                   color: ct.warning },
    digital:    { key: "digital",    label: "Digital Assets", icon: "currency_bitcoin",      color: ct.palette[7] ?? "#BF5AF2" },
    // The palette's other hues are taken (or near-duplicates of taken ones), so hard assets use the neutrals.
    realEstate: { key: "realEstate", label: "Real Estate",   icon: "home",                   color: ct.accentHead },
    vehicle:    { key: "vehicle",    label: "Vehicles",      icon: "directions_car",         color: ct.palette[4] ?? "#FF2D55" },
    otherAsset: { key: "otherAsset", label: "Other Assets",  icon: "category",               color: ct.foregroundMuted },
    debt:       { key: "debt",       label: "Debt",          icon: "credit_card",            color: ct.error },
  }
}
