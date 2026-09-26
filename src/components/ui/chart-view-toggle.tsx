"use client"

import { cn } from "@/lib/utils"

interface Props<K extends string> {
  views: ReadonlyArray<{ key: K; label: string }>
  view: K
  onChange: (view: K) => void
}

/** Segmented control for switching a chart between views (Total / breakdowns). */
export function ChartViewToggle<K extends string>({ views, view, onChange }: Props<K>) {
  return (
    <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onChange(v.key)}
          className={cn(
            "px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors duration-150 whitespace-nowrap",
            view === v.key ? "bg-primary text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
