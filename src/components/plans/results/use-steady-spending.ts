"use client"

import { inflationOf } from "@/lib/plans/plan-inflation"
import { useMemo } from "react"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { expensesView } from "@/lib/plans/plan-chart-detail"
import { rowsForBasis } from "@/lib/plans/plan-dollars"
import type { DollarBasis, PlanDocument } from "@/lib/plans/plan-types"

/**
 * What the Expenses view's total would be each year with every spending line steady (no patterns), in the
 * chart's dollar basis. Null when off, or when no line has a pattern (it would match the bars exactly).
 */
export function useSteadySpending(doc: PlanDocument, basis: DollarBasis, enabled: boolean): number[] | null {
  return useMemo(() => {
    if (!enabled || !doc.expenses.some((e) => !e.oneTime && e.pattern)) return null
    const steady: PlanDocument = { ...doc, expenses: doc.expenses.map((e) => (e.pattern ? { ...e, pattern: undefined } : e)) }
    const rows = rowsForBasis(simulatePlan(steady).rows, basis, inflationOf(doc.settings))
    return expensesView(steady, rows, false).points.map((p) => p.spent ?? 0)
  }, [doc, basis, enabled])
}
