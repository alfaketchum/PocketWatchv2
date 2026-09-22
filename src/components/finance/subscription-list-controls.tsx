"use client"

import { cn } from "@/lib/utils"

export type SubTab = "suggested" | "active" | "dismissed"
export type SubSort = "flat" | "frequency" | "cost" | "date"
export type SubView = "table" | "card"

interface SubscriptionListControlsProps {
  tab: SubTab
  counts: Record<SubTab, number>
  onTabChange: (tab: SubTab) => void
  sortBy: SubSort
  onSortChange: (sort: SubSort) => void
  view: SubView
  onViewChange: (view: SubView) => void
  showSort: boolean
}

const SORT_OPTIONS: Array<{ key: SubSort; label: string }> = [
  { key: "flat", label: "None" },
  { key: "frequency", label: "Frequency" },
  { key: "cost", label: "Cost" },
  { key: "date", label: "Date" },
]

export function SubscriptionListControls({
  tab, counts, onTabChange, sortBy, onSortChange, view, onViewChange, showSort,
}: SubscriptionListControlsProps) {
  const tabs: Array<{ key: SubTab; label: string }> = [
    { key: "suggested", label: "Suggested" },
    { key: "active", label: "Active" },
    { key: "dismissed", label: "Dismissed" },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg w-fit">
        {tabs.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onTabChange(opt.key)}
            className={cn(
              "px-3 py-1 text-[10px] font-medium rounded-md transition-colors duration-150",
              tab === opt.key ? "bg-primary text-white shadow-sm" : "bg-transparent text-foreground-muted hover:text-foreground",
            )}
          >
            {opt.label}
            {counts[opt.key] > 0 && (
              <span className={cn("ml-1 tabular-nums", tab === opt.key ? "text-white/70" : "text-foreground-muted/50")}>
                {counts[opt.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {/* Group by */}
        {showSort && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-foreground-muted">Group by:</span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onSortChange(opt.key)}
                className={cn(
                  "px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                  sortBy === opt.key ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
          {(["table", "card"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={cn(
                "flex items-center justify-center w-7 h-6 rounded-md transition-colors",
                view === v ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
              title={v === "table" ? "Table view" : "Card view"}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
                {v === "table" ? "table_rows" : "grid_view"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
