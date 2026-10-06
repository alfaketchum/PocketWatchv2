"use client"

import { useMemo } from "react"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { useOutcomeColors } from "./use-outcome-colors"
import { DANGER_YEARS } from "@/lib/plans/stress/stress-close-calls"
import { outcomeBuckets, type OutcomeBucket, type OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const BUCKETS_INFO = `Measured on the money in your accounts: running out means your accounts couldn't pay a year's spending. Your home and other property don't pay the bills unless the plan sells them. Lowest point is the fewest years of spending your accounts held while you lived off them; each year under ${DANGER_YEARS} years adds to the danger-years (a year at $0 counts 1, a year at half that cushion counts half). Typical values shown.`

/** Years listed per bucket before "and N more". */
const MAX_YEARS = 6
/** Cushions past this read as "50+ yrs". */
const MAX_CUSHION = 50

const yrs = (v: number) => (v >= MAX_CUSHION ? `${MAX_CUSHION}+ yrs` : `${v < 10 ? v.toFixed(1) : Math.round(v)} yrs`)

/** "Lowest point 1.4 yrs of spending at 74 · 2.3 danger-years": how close the bucket's typical period came to running out. */
function closenessLine(b: OutcomeBucket): string | null {
  if (b.count === 0 || b.dangerArea === undefined) return null
  const area = b.dangerArea < 0.05 ? `never under ${DANGER_YEARS} yrs` : `${b.dangerArea.toFixed(1)} danger-years`
  return b.lowPoint ? `Lowest point ${yrs(b.lowPoint.years)} of spending at ${b.lowPoint.age} · ${area}` : area
}

/** The outcomes as a share bar, then one row each: share, count, the rule in this plan's numbers, and the years. */
export function StressOutcomeBuckets({ cohorts, yardsticks, isHidden }: { cohorts: CohortResult[]; yardsticks: OutcomeYardsticks; isHidden: boolean }) {
  const colors = useOutcomeColors()
  // "Lasted by selling the home" only shows when a home's backup plan actually kicked in.
  const buckets = useMemo(() => outcomeBuckets(cohorts, yardsticks).filter((b) => b.key !== "soldHome" || b.count > 0), [cohorts, yardsticks])
  const total = cohorts.length
  // Simulated trials mix eras, so their start years say little; the historical replay lists them.
  const simulated = cohorts.some((c) => c.trial !== undefined)
  return (
    <div className="mt-5 space-y-3" style={isHidden ? { filter: "blur(6px)" } : undefined}>
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">How the {total} {simulated ? "trials" : "periods"} ended</p>
        <InfoTooltip content={BUCKETS_INFO}>
          <span className="material-symbols-rounded cursor-help text-foreground-muted" style={{ fontSize: 13 }}>
            info
          </span>
        </InfoTooltip>
      </div>
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
              {!simulated && b.years.length > 0 && (
                <span className="block text-foreground-muted/80">
                  {b.years.slice(0, MAX_YEARS).join(", ")}
                  {b.years.length > MAX_YEARS && ` and ${b.years.length - MAX_YEARS} more`}
                </span>
              )}
              {closenessLine(b) && <span className="block text-foreground">{closenessLine(b)}</span>}
              {b.note && <span className="block text-foreground">{b.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
