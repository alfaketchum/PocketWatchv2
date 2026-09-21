"use client"

import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import {
  BUDGET_LOOKBACK_PRESETS,
  getBudgetLookbackRange,
  type BudgetRange,
} from "./budget-helpers"

interface BudgetLookbackSelectorProps {
  value: BudgetRange
  onChange: (range: BudgetRange) => void
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Lookback / date-range control: preset chips (This Month · 2W · 1M · 3M · 6M)
 * plus a custom From/To range using the pop-out calendar picker.
 */
export function BudgetLookbackSelector({ value, onChange }: BudgetLookbackSelectorProps) {
  const todayIso = iso(new Date())

  const setStart = (start: string) =>
    onChange({ key: "custom", label: "Custom", startDate: start, endDate: value.endDate ?? todayIso, isThisMonth: false })
  const setEnd = (end: string) =>
    onChange({ key: "custom", label: "Custom", startDate: value.startDate ?? end, endDate: end, isThisMonth: false })

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
                "text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors tabular-nums",
                active ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Custom From / To — pop-out calendar */}
      <div className="flex items-center gap-1.5">
        <div className="w-[150px]">
          <DatePicker value={value.startDate ?? ""} onChange={setStart} placeholder="From" className="!min-h-0 !py-1.5 text-xs" />
        </div>
        <span className="text-xs text-foreground-muted">to</span>
        <div className="w-[150px]">
          <DatePicker value={value.endDate ?? ""} min={value.startDate} onChange={setEnd} placeholder="To" className="!min-h-0 !py-1.5 text-xs" />
        </div>
      </div>
    </div>
  )
}
