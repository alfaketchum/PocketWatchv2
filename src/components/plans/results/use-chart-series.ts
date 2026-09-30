"use client"

import { useMemo } from "react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import {
  CASH_FLOW_LABELS,
  CASH_IN_LAYERS,
  CASH_OUT_LAYERS,
  cashFlowPoints,
  debtPoints,
  NET_WORTH_LAYER_LABELS,
  NET_WORTH_LAYERS,
  netWorthPoints,
  type CashFlowLayer,
  type NetWorthLayer,
} from "@/lib/plans/plan-chart"
import { cashFlowDetail, EXPENSE_GROUP_LABELS, expensesView, netWorthDetail, type ExpenseGroup } from "@/lib/plans/plan-chart-detail"
import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"
import { shades, usePlanColors } from "./use-plan-colors"

export type ChartMode = "networth" | "cashflow" | "expenses" | "debt"

export interface Series {
  key: string
  label: string
  color: string
  /** With subcategories on: the band this line rolls up into (for the hover card). */
  group?: { key: string; label: string; color: string }
}

export type ChartRow = { age: number; year: number } & Record<string, number>

function loanTotals(row: YearRow | undefined): { loanPrincipal: number; loanInterest: number } {
  if (!row) return { loanPrincipal: 0, loanInterest: 0 }
  const interest = Math.min(row.debtPayments, row.debtInterest)
  return { loanPrincipal: row.debtPayments - interest, loanInterest: interest }
}

/** Colors each subcategory as a shade of its parent band's color. */
function shadeDetail<P extends string>(
  detail: { key: string; label: string; parent: P }[],
  parentColor: (parent: P) => string,
  parentLabel: (parent: P) => string,
  theme: { card: string; foreground: string },
): Series[] {
  const byParent = new Map<P, typeof detail>()
  for (const s of detail) byParent.set(s.parent, [...(byParent.get(s.parent) ?? []), s])
  return [...byParent.entries()].flatMap(([parent, list]) => {
    const base = parentColor(parent)
    const colors = shades(base, list.length, theme)
    const group = { key: String(parent), label: parentLabel(parent), color: base }
    return list.map((s, i) => ({ key: s.key, label: s.label, color: colors[i], group }))
  })
}

/**
 * The bars for the chosen view: grouped bands, or (with `detail`) every account, asset, loan, income,
 * spending line and kind of tax as a shade of its band. Debt is always per loan. Empty bands are dropped.
 */
export function useChartSeries(doc: PlanDocument, rows: YearRow[], mode: ChartMode, detail: boolean) {
  const { card, foreground } = useChartTheme()
  const { netWorth: nwColors, cashFlow: cfColors } = usePlanColors()
  const nwPoints = useMemo(() => netWorthPoints(doc, rows), [doc, rows])
  const hasDebt = useMemo(() => nwPoints.some((p) => p.debt < -0.5), [nwPoints])
  // The Debt view only exists while the plan has debt; fall back if it's all gone.
  const view: ChartMode = mode === "debt" && !hasDebt ? "networth" : mode

  const { points, all } = useMemo((): { points: ChartRow[]; all: Series[] } => {
    const theme = { card, foreground }
    if (view === "debt") {
      const colors = shades(nwColors.debt, doc.debts.length, theme)
      return { points: debtPoints(doc, rows), all: doc.debts.map((d, i) => ({ key: d.id, label: d.name, color: colors[i] })) }
    }
    if (view === "expenses") {
      const groupColor: Record<ExpenseGroup, string> = {
        living: cfColors.spending,
        kids: cfColors.income,
        property: nwColors.realAssets,
        taxes: cfColors.taxes,
        debt: cfColors.debtPayments,
      }
      const e = expensesView(doc, rows, detail)
      if (!detail) return { points: e.points, all: e.series.map((s) => ({ key: s.key, label: s.label, color: groupColor[s.group] })) }
      const byGroup = e.series.map((s) => ({ key: s.key, label: s.label, parent: s.group }))
      return { points: e.points, all: shadeDetail(byGroup, (g) => groupColor[g], (g) => EXPENSE_GROUP_LABELS[g], theme) }
    }
    if (view === "networth") {
      if (!detail) {
        const keys = [...NET_WORTH_LAYERS, "debt" as const]
        return { points: nwPoints, all: keys.map((k) => ({ key: k, label: NET_WORTH_LAYER_LABELS[k], color: nwColors[k] })) }
      }
      const d = netWorthDetail(doc, rows)
      return {
        points: d.points,
        all: shadeDetail(d.series, (p) => nwColors[p as NetWorthLayer | "debt"], (p) => NET_WORTH_LAYER_LABELS[p as NetWorthLayer | "debt"], theme),
      }
    }
    if (!detail) {
      const keys = [...CASH_IN_LAYERS, ...CASH_OUT_LAYERS]
      return { points: cashFlowPoints(doc, rows), all: keys.map((k) => ({ key: k, label: CASH_FLOW_LABELS[k], color: cfColors[k] })) }
    }
    const d = cashFlowDetail(doc, rows)
    return { points: d.points, all: shadeDetail(d.series, (p) => cfColors[p as CashFlowLayer], (p) => CASH_FLOW_LABELS[p as CashFlowLayer], theme) }
  }, [view, detail, doc, rows, nwPoints, nwColors, cfColors, card, foreground])

  // Each year's loan payments split into principal and interest, for the hover card (not drawn as bars).
  const withLoans = useMemo(
    () => (view === "networth" ? points : points.map((p, i) => ({ ...p, ...loanTotals(rows[i]) }))),
    [view, points, rows],
  )
  const series = useMemo(() => all.filter((s) => points.some((p) => Math.abs(p[s.key] ?? 0) > 0.5)), [all, points])
  return { view, points: withLoans, series, nwPoints, hasDebt }
}
