"use client"

import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { ExtraYearResult } from "@/lib/fire/fire-analysis"
import { fmtCompact, fmtPct, fmtSuccess } from "./fire-helpers"

/** Compact 0–N extra-years comparison: withdrawal rate, historical success, and safe spending. */
export function OneMoreYearStrip({ rows, isHidden }: { rows: ExtraYearResult[]; isHidden: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
      {rows.map((r) => {
        const success = r.successRate ?? 0
        return (
          <div
            key={r.extraYears}
            className={cn("rounded-lg border px-2 py-2 text-center", r.extraYears === 0 ? "border-primary/40 bg-primary/5" : "border-card-border")}
          >
            <p className="text-[10px] text-foreground-muted">{r.extraYears === 0 ? "At FI" : `+${r.extraYears} yr`}</p>
            <p className={cn("text-sm font-bold tabular-nums", success >= 0.99 ? "text-success" : success >= 0.9 ? "text-warning" : "text-error")}>
              {fmtSuccess(r.successRate)}
            </p>
            <p className="text-[10px] text-foreground-muted tabular-nums">{fmtPct(r.withdrawalRate, 2)} WR</p>
            <BlurredValue isHidden={isHidden}>
              <p className="text-[10px] text-foreground tabular-nums">{r.safeSpend !== null ? `${fmtCompact(r.safeSpend)}/yr safe` : "—"}</p>
            </BlurredValue>
          </div>
        )
      })}
    </div>
  )
}
