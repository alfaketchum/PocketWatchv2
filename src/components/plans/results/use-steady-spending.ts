"use client"

import { inflationOf } from "@/lib/plans/plan-inflation"
import { useMemo } from "react"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { expensesView } from "@/lib/plans/plan-chart-detail"
import { rowsForBasis } from "@/lib/plans/plan-dollars"
import type { DollarBasis, PlanDocument } from "@/lib/plans/plan-types"

/** The Expenses view's dashed comparison line: its yearly totals and what it shows. */
export interface SpendingBaseline {
  values: number[]
  label: string
}

/**
 * The Expenses view's comparison, in the chart's dollar basis: with a spending rule, the same plan spending as
 * written (no rule); otherwise, with spending patterns, every line steady. Null when off or when it would match
 * the bars exactly.
 */
export function useSteadySpending(doc: PlanDocument, basis: DollarBasis, enabled: boolean): SpendingBaseline | null {
  return useMemo(() => {
    if (!enabled) return null
    const ruled = !!doc.settings.spendingRule
    if (!ruled && !doc.expenses.some((e) => !e.oneTime && e.pattern)) return null
    const baseline: PlanDocument = ruled
      ? { ...doc, settings: { ...doc.settings, spendingRule: undefined } }
      : { ...doc, expenses: doc.expenses.map((e) => (e.pattern ? { ...e, pattern: undefined } : e)) }
    const rows = rowsForBasis(simulatePlan(baseline).rows, basis, inflationOf(doc.settings))
    return {
      values: expensesView(baseline, rows, false).points.map((p) => p.spent ?? 0),
      label: ruled ? "As planned (no spending rule)" : "All steady (no spending patterns)",
    }
  }, [doc, basis, enabled])
}
