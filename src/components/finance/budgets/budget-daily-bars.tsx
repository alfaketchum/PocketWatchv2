"use client"

import { formatCurrency } from "@/lib/utils"

interface BudgetDailyBarsProps {
  data: Array<{ date: string; amount: number }>
  /** Currently drilled-in day (YYYY-MM-DD), or null for all days. */
  selected?: string | null
  /** Click a day to filter the transactions below to that day. */
  onSelect?: (date: string | null) => void
}

/** Compact daily-spending bar chart (one bar per calendar day in the period). */
export function BudgetDailyBars({ data, selected = null, onSelect }: BudgetDailyBarsProps) {
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
          const isSel = d.date === selected
          const baseOpacity = isSel ? 1 : isPeak ? 0.9 : 0.8
          const opacity = selected && !isSel ? 0.3 : baseOpacity
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelect?.(isSel ? null : d.date)}
              className="flex-1 h-full flex flex-col justify-end group relative cursor-pointer"
              title={`${d.date.slice(5)} · ${formatCurrency(d.amount)}`}
              aria-pressed={isSel}
              aria-label={`${d.date} spending ${formatCurrency(d.amount)}`}
            >
              <div
                className="w-full rounded-t-[2px] transition-all"
                style={{
                  height: `${Math.max(pct, d.amount > 0 ? 2 : 0)}%`,
                  background: isSel ? "var(--foreground)" : isPeak ? "var(--error)" : "var(--primary)",
                  opacity,
                }}
              />
            </button>
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
