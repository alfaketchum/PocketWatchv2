"use client"

import { NetWorthChart } from "@/components/finance/net-worth-chart"

interface HistoryPoint {
  date: string
  fiat: number
  crypto: number
  total: number
}

interface NetWorthHistoryChartProps {
  data: HistoryPoint[]
  height?: number
}

type Range = "1w" | "1m" | "3m" | "6m" | "1y" | "all"

function rangeForSpan(days: number): Range {
  if (days <= 8) return "1w"
  if (days <= 32) return "1m"
  if (days <= 95) return "3m"
  if (days <= 185) return "6m"
  return "1y"
}

/**
 * Net-worth history chart — reuses the dashboard's finance NetWorthChart so the
 * styling, axis labels, hover tooltip and scroll behavior match exactly. The
 * fiat/crypto split is surfaced in the breakdown cards + sidebar, not the line.
 */
export function NetWorthHistoryChart({ data, height = 280 }: NetWorthHistoryChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-foreground-muted text-sm" style={{ height }}>
        Not enough history for chart
      </div>
    )
  }

  const spanDays = (new Date(data[data.length - 1].date).getTime() - new Date(data[0].date).getTime()) / 86_400_000
  const mapped = data.map((p) => ({ date: p.date, fiatNetWorth: p.fiat, totalNetWorth: p.total }))

  return <NetWorthChart data={mapped} range={rangeForSpan(spanDays)} height={height} />
}
