"use client"

import { useMemo } from "react"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { mix } from "@/components/plans/results/use-plan-colors"
import { outcomeBuckets, type OutcomeKey, type OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

/** Years listed per bucket before "and N more". */
const MAX_YEARS = 6

/** The outcomes as a share bar, then one row each: share, count, the rule in this plan's numbers, and the years. */
export function StressOutcomeBuckets({ cohorts, yardsticks, isHidden }: { cohorts: CohortResult[]; yardsticks: OutcomeYardsticks; isHidden: boolean }) {
  const { success, warning, error, card, primary } = useChartTheme()
  // "Lasted by selling the home" only shows when a home's backup plan actually kicked in.
  const buckets = useMemo(() => outcomeBuckets(cohorts, yardsticks).filter((b) => b.key !== "soldHome" || b.count > 0), [cohorts, yardsticks])
  // Good to bad: green, faded green, light amber, amber, red; selling the home is its own (accent) case. Theme tokens, so dark mode follows.
  const colors: Record<OutcomeKey, string> = {
    surplus: success,
    steady: mix(success, card, 0.5),
    justMadeIt: mix(warning, card, 0.5),
    soldHome: primary,
    almostSurvived: warning,
    catastrophic: error,
  }
  const total = cohorts.length
  return (
    <div className="mt-5 space-y-3" style={isHidden ? { filter: "blur(6px)" } : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">How the {total} periods ended</p>
      </div>
      <p className="text-[11px] text-foreground-muted">
        Measured on the money in your accounts, whichever the chart shows: running out means your accounts couldn&apos;t pay a year&apos;s
        spending. Your home and other property don&apos;t pay the bills unless the plan sells them.
      </p>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={buckets.map((b) => `${b.label} ${Math.round(b.share * 100)}%`).join(", ")}>
        {buckets
          .filter((b) => b.count > 0)
          .map((b) => (
            <span key={b.key} title={`${b.label}: ${b.count} of ${total}`} style={{ flex: b.count, background: colors[b.key] }} />
          ))}
      </div>
      <ul className="divide-y divide-card-border/60">
        {buckets.map((b) => (
          <li key={b.key} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[10rem_7rem_1fr] sm:items-baseline">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colors[b.key] }} aria-hidden="true" />
              {b.label}
            </span>
            <span className="text-right text-sm tabular-nums text-foreground sm:text-left">
              {Math.round(b.share * 100)}% <span className="text-[11px] text-foreground-muted">· {b.count}</span>
            </span>
            <span className="col-span-2 text-[11px] leading-snug text-foreground-muted sm:col-span-1">
              {b.rule}
              {b.years.length > 0 && (
                <span className="block text-foreground-muted/80">
                  {b.years.slice(0, MAX_YEARS).join(", ")}
                  {b.years.length > MAX_YEARS && ` and ${b.years.length - MAX_YEARS} more`}
                </span>
              )}
              {b.note && <span className="block text-foreground">{b.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
