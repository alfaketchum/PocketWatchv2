"use client"

import type { PlanSummary } from "@/lib/plans/plan-types"
import { Delta, METRICS } from "../compare/compare-table"

/** The headline differences, shown while dialling. */
const SHOWN = ["Ending net worth", "Cash lasts"]

/**
 * Below lg the dials sit above the results, so moving one changes nothing in view: this bar stays on screen above
 * the bottom nav with what the dials have changed so far.
 */
export function WhatIfPhoneSummary({ a, b, isHidden }: { a: PlanSummary; b: PlanSummary; isHidden: boolean }) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-around gap-3 rounded-xl border border-card-border bg-card px-4 py-2.5 text-xs lg:hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      {METRICS.filter((m) => SHOWN.includes(m.label)).map((m) => (
        <div key={m.label} className="min-w-0 text-center">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{m.label}</p>
          <p className="font-data tabular-nums">
            <Delta metric={m} a={a} b={b} isHidden={isHidden} />
          </p>
        </div>
      ))}
    </div>
  )
}
