"use client"

import { formatCurrency, cn } from "@/lib/utils"

export interface DonutSlice {
  category: string
  amount: number
  color: string
}

interface BudgetSpendingDonutProps {
  slices: DonutSlice[]
  /** Budget per category for the period (outer ring); same colors as the spending slices. */
  budgetSlices: DonutSlice[]
  total: number
  budget: number
  selected: string | null
  onSelect: (category: string | null) => void
}

// Inner ring = spending, outer ring = budget.
const INNER_R = 35
const INNER_STROKE = 12
const OUTER_R = 46
const OUTER_STROKE = 6
const SELECTED_GROW = 2

interface RingProps {
  slices: DonutSlice[]
  /** Shared scale for both rings so arc lengths are comparable (max of spend and budget). */
  scale: number
  r: number
  stroke: number
  opacity: number
  label: string
  selected: string | null
  onSelect: (category: string | null) => void
}

function Ring({ slices, scale, r, stroke, opacity, label, selected, onSelect }: RingProps) {
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--card-border)" strokeWidth={stroke} opacity={0.35} />
      {slices.map((s) => {
        const dash = scale > 0 ? (s.amount / scale) * circumference : 0
        const dim = selected != null && selected !== s.category
        const el = (
          <circle
            key={s.category}
            cx="50" cy="50" r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={selected === s.category ? stroke + SELECTED_GROW : stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            opacity={dim ? 0.25 * opacity : opacity}
            className="cursor-pointer transition-[stroke-width,opacity] duration-150"
            onClick={() => onSelect(selected === s.category ? null : s.category)}
          >
            <title>{`${s.category} · ${label} ${formatCurrency(s.amount, "USD", 0)}`}</title>
          </circle>
        )
        offset += dash
        return el
      })}
    </>
  )
}

/**
 * Two-ring donut: the inner ring is spending by category, the outer ring is
 * budget by category, on a shared scale so under/over budget shows as ring gaps.
 * Clicking an arc on either ring selects that category.
 */
export function BudgetSpendingDonut({ slices, budgetSlices, total, budget, selected, onSelect }: BudgetSpendingDonutProps) {
  const selectedSlice = selected ? slices.find((s) => s.category === selected) : null
  const selectedBudget = selected ? budgetSlices.find((s) => s.category === selected)?.amount ?? null : null
  const overUnder = budget - total
  const scale = Math.max(total, budget)
  const hasBudget = budgetSlices.length > 0

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="relative w-[196px] h-[196px]">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <Ring slices={slices} scale={scale} r={INNER_R} stroke={INNER_STROKE} opacity={1} label="spent" selected={selected} onSelect={onSelect} />
          {hasBudget && (
            <Ring slices={budgetSlices} scale={scale} r={OUTER_R} stroke={OUTER_STROKE} opacity={0.6} label="budget" selected={selected} onSelect={onSelect} />
          )}
        </svg>

        {/* Center label */}
        <button
          onClick={() => onSelect(null)}
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-10"
          title={selected ? "Back to all spending" : undefined}
        >
          {selectedSlice ? (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted truncate max-w-full">{selectedSlice.category}</span>
              <span className="stat-value text-xl text-foreground mt-0.5">{formatCurrency(selectedSlice.amount, "USD", 0)}</span>
              {selectedBudget != null && (
                <span className="text-[10px] text-foreground-muted">of {formatCurrency(selectedBudget, "USD", 0)}</span>
              )}
              <span className="text-[10px] text-primary mt-1">← all spending</span>
            </>
          ) : (
            <>
              <span className="stat-value text-[22px] text-foreground">{formatCurrency(total, "USD", 0)}</span>
              <span className="text-[11px] text-foreground-muted mt-0.5">of {formatCurrency(budget, "USD", 0)}</span>
              <span className={cn("text-[11px] font-semibold mt-1", overUnder >= 0 ? "text-success" : "text-error")}>
                {formatCurrency(Math.abs(overUnder), "USD", 0)} {overUnder >= 0 ? "under" : "over"}
              </span>
            </>
          )}
        </button>
      </div>
      {hasBudget && (
        <p className="text-[10px] text-foreground-muted flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-[3px] border-foreground-muted" />Spent</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-foreground-muted/60" />Budget</span>
        </p>
      )}
    </div>
  )
}
