"use client"

import { useQuery } from "@tanstack/react-query"
import { plansFetch, plansKeys } from "./shared"

export interface CategorySpendingItem {
  category: string
  avgMonthly: number
  medianMonthly: number
  budgetMonthly: number | null
}

/** Spending by budget category, measured the way "Start from my data" measures it (12 months). */
export function useCategorySpending() {
  return useQuery({
    queryKey: plansKeys.categorySpending(),
    queryFn: () => plansFetch<{ months: number; categories: CategorySpendingItem[] }>("/category-spending"),
    staleTime: 10 * 60_000,
  })
}
