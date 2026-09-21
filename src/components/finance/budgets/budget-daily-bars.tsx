"use client"

import { formatCurrency } from "@/lib/utils"

interface BudgetDailyBarsProps {
  data: Array<{ date: string; amount: number }>
}

/** Compact daily-spending bar chart (one bar per day in the period). */
export function BudgetDailyBars({ data }: BudgetDailyBarsProps) {
  if (data.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-xs text-foreground-muted">
        No spending in this period
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.amount), 1)
  const peak = data.reduce((a, b) => (b.amount > a.amount ? b : a), data[0])

  return (
    <div className="w-full">
      <div className="flex items-end gap-[2px] h-[160px]">
        {data.map((d) => {
          const pct = (d.amount / max) * 100
          const isPeak = d.date === peak.date && d.amount > 0
          return (
            <div key={d.date} className="flex-1 flex flex-col justify-end group relative" title={`${d.date.slice(5)} · ${formatCurrency(d.amount)}`}>
              <div
                className="w-full rounded-t-[2px] transition-colors"
                style={{ height: `${Math.max(pct, d.amount > 0 ? 2 : 0)}%`, background: isPeak ? "var(--error)" : "var(--primary)", opacity: isPeak ? 0.9 : 0.8 }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-foreground-muted mt-1.5 tabular-nums">
        <span>{data[0]?.date.slice(5)}</span>
        <span>peak {formatCurrency(peak.amount, "USD", 0)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}
