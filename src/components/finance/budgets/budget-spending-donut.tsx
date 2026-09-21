"use client"

import { formatCurrency, cn } from "@/lib/utils"

export interface DonutSlice {
  category: string
  amount: number
  color: string
}

interface BudgetSpendingDonutProps {
  slices: DonutSlice[]
  total: number
  budget: number
  selected: string | null
  onSelect: (category: string | null) => void
}

const R = 42
const STROKE = 14
const C = 2 * Math.PI * R

/**
 * Spending donut: each arc is a category. Clicking an arc selects that category
 * (decomposes to its transactions); the center reflects the selection.
 */
export function BudgetSpendingDonut({ slices, total, budget, selected, onSelect }: BudgetSpendingDonutProps) {
  let offset = 0
  const selectedSlice = selected ? slices.find((s) => s.category === selected) : null
  const overUnder = budget - total
  const centerAmount = selectedSlice ? selectedSlice.amount : total

  return (
    <div className="relative w-[180px] h-[180px] flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {/* Track */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--card-border)" strokeWidth={STROKE} opacity={0.35} />
        {slices.map((s) => {
          const frac = total > 0 ? s.amount / total : 0
          const dash = frac * C
          const dim = selected != null && selected !== s.category
          const el = (
            <circle
              key={s.category}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={selected === s.category ? STROKE + 3 : STROKE}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
              opacity={dim ? 0.28 : 1}
              className="cursor-pointer transition-[stroke-width,opacity] duration-150"
              onClick={() => onSelect(selected === s.category ? null : s.category)}
            />
          )
          offset += dash
          return el
        })}
      </svg>

      {/* Center label */}
      <button
        onClick={() => onSelect(null)}
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
        title={selected ? "Back to all spending" : undefined}
      >
        {selectedSlice ? (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted truncate max-w-full">{selectedSlice.category}</span>
            <span className="stat-value text-2xl text-foreground mt-0.5">{formatCurrency(centerAmount, "USD", 0)}</span>
            <span className="text-[10px] text-primary mt-1">← all spending</span>
          </>
        ) : (
          <>
            <span className="stat-value text-[26px] text-foreground">{formatCurrency(total, "USD", 0)}</span>
            <span className="text-[11px] text-foreground-muted mt-0.5">of {formatCurrency(budget, "USD", 0)}</span>
            <span className={cn("text-[11px] font-semibold mt-1", overUnder >= 0 ? "text-success" : "text-error")}>
              {formatCurrency(Math.abs(overUnder), "USD", 0)} {overUnder >= 0 ? "under" : "over"}
            </span>
          </>
        )}
      </button>
    </div>
  )
}
