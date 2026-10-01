"use client"

import { useMemo } from "react"
import { useCategories } from "@/hooks/finance/use-categories"
import { useCategorySpending } from "@/hooks/plans/use-category-spending"
import { getLifestyleCategories } from "@/lib/finance/budget-builder-config"
import { FINANCE_CATEGORIES } from "@/lib/finance/categories"

export interface ExpenseCategory {
  label: string
  icon: string
  hex: string
  /** Your monthly spending in it over the last 12 months (as "Start from my data" measures it); null without data. */
  avgMonthly: number | null
  medianMonthly: number | null
  budgetMonthly: number | null
}

const FALLBACK = { icon: "category", hex: "#64748b" }

/**
 * The spending categories plan expenses use: the same ones the budget builder offers (built-in lifestyle
 * categories, then your custom ones), each with your average monthly spending when Finance has it.
 */
export function useExpenseCategories(): ExpenseCategory[] {
  const { data: merged } = useCategories()
  const { data: spending } = useCategorySpending()
  return useMemo(() => {
    const by = new Map((spending?.categories ?? []).map((s) => [s.category, s]))
    const builtIn = getLifestyleCategories().map((label) => ({ label, icon: FINANCE_CATEGORIES[label]?.icon ?? FALLBACK.icon, hex: FINANCE_CATEGORIES[label]?.hex ?? FALLBACK.hex }))
    const custom = (merged?.categories ?? []).filter((c) => c.isCustom).map((c) => ({ label: c.label, icon: c.icon || FALLBACK.icon, hex: c.hex || FALLBACK.hex }))
    return [...builtIn, ...custom].map((c) => {
      const s = by.get(c.label)
      return { ...c, avgMonthly: s?.avgMonthly || null, medianMonthly: s?.medianMonthly || null, budgetMonthly: s?.budgetMonthly ?? null }
    })
  }, [merged, spending])
}
