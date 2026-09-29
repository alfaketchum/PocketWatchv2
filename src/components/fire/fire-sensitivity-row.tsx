"use client"

import { cn } from "@/lib/utils"
import type { SensitivityItem } from "@/lib/fire/fire-sensitivity"

function fmtDelta(years: number | null): string {
  if (years === null) return "—"
  const abs = Math.abs(years)
  const amount = abs < 1 ? `${Math.max(1, Math.round(abs * 12))} mo` : `${abs.toFixed(1)} yrs`
  if (abs < 1 / 24) return "no change"
  return years < 0 ? `${amount} sooner` : `${amount} later`
}

/** "What moves your date" — three quick what-ifs under the path chart. */
export function FireSensitivityRow({ items }: { items: SensitivityItem[] }) {
  if (items.every((i) => i.deltaYears === null)) return null
  return (
    <div className="mt-4 pt-3 border-t border-card-border">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted mb-2">What moves your date</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.key} className="rounded-lg bg-foreground/[0.03] px-3 py-2">
            <p className="text-xs text-foreground">{i.label}</p>
            <p className={cn("text-sm font-semibold tabular-nums", i.deltaYears === null ? "text-foreground-muted" : i.deltaYears < 0 ? "text-success" : "text-error")}>
              {fmtDelta(i.deltaYears)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
