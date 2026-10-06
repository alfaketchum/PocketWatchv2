"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import { cn } from "@/lib/utils"

/**
 * Below lg the year panel sits under the chart, out of sight: this one line above the chart shows that tapping a bar
 * pinned it, with a jump down to the full panel.
 */
export function PlanYearSummaryBar({
  age,
  year,
  netWorth,
  change,
  onDetails,
  onUnpin,
}: {
  age: number
  year: number
  netWorth: number
  change: number
  onDetails: () => void
  onUnpin: () => void
}) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-card-border bg-background-secondary/60 py-1 pl-3 pr-1 lg:hidden">
      <span className="material-symbols-rounded text-primary" style={{ fontSize: 15 }} aria-hidden="true">
        push_pin
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
        <span className="font-semibold">{year}</span>
        <span className="text-foreground-muted"> · Age {age} · </span>
        <span className="font-data font-semibold tabular-nums">{fmtCompact(netWorth)}</span>
        <span className={cn("font-data tabular-nums", change >= 0 ? "text-success" : "text-error")}>
          {" "}
          {change >= 0 ? "+" : "−"}
          {fmtCompact(Math.abs(change))}
        </span>
      </span>
      <button type="button" onClick={onDetails} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 px-2 text-xs font-medium text-primary">
        Details
        <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
          south
        </span>
      </button>
      <button
        type="button"
        onClick={onUnpin}
        aria-label={`Unpin ${year}`}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground-muted hover:text-foreground"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
          close
        </span>
      </button>
    </div>
  )
}
