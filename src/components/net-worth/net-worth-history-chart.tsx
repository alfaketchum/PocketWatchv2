"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { NetWorthChart } from "@/components/finance/net-worth-chart"

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

type CatKey = "total" | "cash" | "savings" | "investment" | "stablecoin" | "digital" | "debt"

const CATEGORIES: Array<{ key: CatKey; label: string; color: string; icon: string }> = [
  { key: "total",      label: "Total",         color: "#8886ff", icon: "account_balance_wallet" },
  { key: "cash",       label: "Cash",          color: "#10b981", icon: "account_balance" },
  { key: "savings",    label: "Savings",       color: "#14b8a6", icon: "savings" },
  { key: "investment", label: "Investments",   color: "#8b5cf6", icon: "trending_up" },
  { key: "stablecoin", label: "Stablecoins",   color: "#0ea5e9", icon: "paid" },
  { key: "digital",    label: "Digital Assets", color: "#f59e0b", icon: "currency_bitcoin" },
  { key: "debt",       label: "Debt",          color: "#ef4444", icon: "credit_card" },
]

type Range = "1w" | "1m" | "3m" | "6m" | "1y" | "all"
function rangeForSpan(days: number): Range {
  if (days <= 8) return "1w"
  if (days <= 32) return "1m"
  if (days <= 95) return "3m"
  if (days <= 185) return "6m"
  return "1y"
}

function valueFor(key: CatKey, p: BreakdownPoint): number {
  if (key === "debt") return p.credit + p.loan
  if (key === "total") return 0
  return p[key]
}

/**
 * Net-worth history chart with category drill-down. Renders the dashboard's
 * finance NetWorthChart (identical styling / labels / hover / scroll); category
 * chips let you drill into a single series (Cash, Savings, Investments,
 * Stablecoins, Digital Assets, Debt) and a back button returns to the total —
 * a smooth in-place state change, no reload.
 */
export function NetWorthHistoryChart({ data, breakdown, height = 280 }: NetWorthHistoryChartProps) {
  const [cat, setCat] = useState<CatKey>("total")

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-foreground-muted text-sm" style={{ height }}>
        Not enough history for chart
      </div>
    )
  }

  const bd = breakdown ?? []
  // Only offer chips for categories that actually carry value.
  const available = CATEGORIES.filter((c) => {
    if (c.key === "total") return true
    return bd.some((p) => Math.abs(valueFor(c.key, p)) > 0.5)
  })
  const active = CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[0]
  const isDrilled = cat !== "total"

  const series = cat === "total"
    ? data.map((p) => ({ date: p.date, fiatNetWorth: p.fiat, totalNetWorth: p.total }))
    : bd.map((p) => ({ date: p.date, fiatNetWorth: 0, totalNetWorth: valueFor(cat, p) }))

  const spanDays = series.length >= 2
    ? (new Date(series[series.length - 1].date).getTime() - new Date(series[0].date).getTime()) / 86_400_000
    : 30

  return (
    <div>
      {/* Category selector / drill-down header */}
      <div className="flex items-center gap-1.5 mb-2 min-h-[26px] flex-wrap">
        {isDrilled ? (
          <>
            <button
              onClick={() => setCat("total")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-muted hover:text-foreground bg-background-secondary border border-card-border rounded-md pl-1 pr-2 py-1 transition-colors"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 15 }} aria-hidden="true">arrow_back</span>
              All
            </button>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: active.color }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">{active.icon}</span>
              {active.label}
            </span>
          </>
        ) : (
          available
            .filter((c) => c.key !== "total")
            .map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground-muted hover:text-foreground bg-background-secondary border border-card-border rounded-full px-2 py-0.5 transition-colors"
                title={`View ${c.label} history`}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
                {c.label}
              </button>
            ))
        )}
      </div>

      <NetWorthChart data={series} range={rangeForSpan(spanDays)} height={height} color={active.color} />
    </div>
  )
}
