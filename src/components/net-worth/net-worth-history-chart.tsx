"use client"

import { useState } from "react"
import { NetWorthChart } from "@/components/finance/net-worth-chart"
import { NetWorthStackedChart, type StackKey } from "./net-worth-stacked-chart"
import { useNetWorthCategories, NW_STACK_ORDER } from "@/hooks/use-net-worth-colors"

interface HistoryPoint {
  date: string
  fiat: number
  crypto: number
  total: number
}

interface BreakdownPoint {
  date: string
  cash: number
  savings: number
  investment: number
  stablecoin: number
  digital: number
  credit: number
  loan: number
}

interface NetWorthHistoryChartProps {
  data: HistoryPoint[]
  breakdown?: BreakdownPoint[]
  height?: number
}

type DrillKey = StackKey | "debt"

type Range = "1w" | "1m" | "3m" | "6m" | "1y" | "all"
function rangeForSpan(days: number): Range {
  if (days <= 8) return "1w"
  if (days <= 32) return "1m"
  if (days <= 95) return "3m"
  if (days <= 185) return "6m"
  return "1y"
}

/**
 * Net-worth history chart. Default view stacks the asset categories (Cash,
 * Savings, Investments, Stablecoins, Digital Assets) into the total; clicking a
 * band or a legend chip drills into that single series (rendered with the finance
 * NetWorthChart for identical styling), and a back button returns to the stack —
 * a smooth in-place state change, no reload. Colors come from the Mercury theme.
 */
export function NetWorthHistoryChart({ data, breakdown, height = 280 }: NetWorthHistoryChartProps) {
  const [drill, setDrill] = useState<DrillKey | null>(null)
  const cats = useNetWorthCategories()

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-foreground-muted text-sm" style={{ height }}>
        Not enough history for chart
      </div>
    )
  }

  const bd = breakdown ?? []
  const stackData = bd.map((p) => ({
    date: p.date, cash: p.cash, savings: p.savings, investment: p.investment, stablecoin: p.stablecoin, digital: p.digital,
  }))

  const availStack = NW_STACK_ORDER.map((k) => cats[k]).filter((l) => stackData.some((p) => (p[l.key as StackKey] || 0) > 0.5))
  const hasDebt = bd.some((p) => (p.credit + p.loan) > 0.5)
  const spanDays = data.length >= 2
    ? (new Date(data[data.length - 1].date).getTime() - new Date(data[0].date).getTime()) / 86_400_000
    : 30

  // ── Drilled view: a single category line ──
  if (drill) {
    const meta = cats[drill]
    const series = drill === "debt"
      ? bd.map((p) => ({ date: p.date, fiatNetWorth: 0, totalNetWorth: p.credit + p.loan }))
      : bd.map((p) => ({ date: p.date, fiatNetWorth: 0, totalNetWorth: (p as unknown as Record<string, number>)[drill] }))
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2 min-h-[26px]">
          <button
            onClick={() => setDrill(null)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-muted hover:text-foreground bg-background-secondary border border-card-border rounded-md pl-1 pr-2 py-1 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">arrow_back</span>
            All
          </button>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: meta.color }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">{meta.icon}</span>
            {meta.label}
          </span>
        </div>
        <NetWorthChart data={series} range={rangeForSpan(spanDays)} height={height} color={meta.color} />
      </div>
    )
  }

  // ── Stacked view + drillable legend ──
  return (
    <div>
      <NetWorthStackedChart data={stackData} height={height} onDrill={setDrill} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1">
        {availStack.map((l) => (
          <button
            key={l.key}
            onClick={() => setDrill(l.key as StackKey)}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors"
            title={`View ${l.label} history`}
          >
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </button>
        ))}
        {hasDebt && (
          <button
            onClick={() => setDrill("debt")}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors"
            title="View Debt history"
          >
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: cats.debt.color }} />
            Debt
          </button>
        )}
      </div>
    </div>
  )
}
