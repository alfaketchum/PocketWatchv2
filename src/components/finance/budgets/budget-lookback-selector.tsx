"use client"

import { cn } from "@/lib/utils"
import {
  BUDGET_LOOKBACK_PRESETS,
  getBudgetLookbackRange,
  type BudgetRange,
} from "./budget-helpers"

interface BudgetLookbackSelectorProps {
  value: BudgetRange
  onChange: (range: BudgetRange) => void
}

/**
 * Lookback / date-range control for the budgets view: preset chips
 * (This Month · 2W · 1M · 3M · 6M) plus a custom From/To date range.
 * Pro-rated budget targets are applied downstream for non-month windows.
 */
export function BudgetLookbackSelector({ value, onChange }: BudgetLookbackSelectorProps) {
  const isCustom = value.key === "custom"

  const setCustom = (start: string | undefined, end: string | undefined) => {
    const startDate = start || value.startDate
    const endDate = end || value.endDate
    if (!startDate || !endDate) return
    onChange({ key: "custom", label: "Custom", startDate, endDate, isThisMonth: false })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Preset chips */}
      <div className="inline-flex items-center bg-background-secondary border border-card-border rounded-lg p-0.5">
        {BUDGET_LOOKBACK_PRESETS.map((p) => {
          const active = value.key === p.key
          return (
            <button
              key={p.key}
              onClick={() => onChange(getBudgetLookbackRange(p.key))}
              className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors tabular-nums",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Custom From / To */}
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs",
          isCustom ? "text-foreground" : "text-foreground-muted",
        )}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">date_range</span>
        <input
          type="date"
          value={value.startDate ?? ""}
          max={value.endDate}
          onChange={(e) => setCustom(e.target.value, undefined)}
          className="bg-background border border-card-border rounded-md px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
          aria-label="From date"
        />
        <span className="text-foreground-muted">to</span>
        <input
          type="date"
          value={value.endDate ?? ""}
          min={value.startDate}
          onChange={(e) => setCustom(undefined, e.target.value)}
          className="bg-background border border-card-border rounded-md px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
          aria-label="To date"
        />
      </div>
    </div>
  )
}
