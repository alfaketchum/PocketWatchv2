"use client"

import { fmtCompact, fmtSuccess } from "@/components/fire/fire-helpers"
import type { StressSummary as Summary } from "@/lib/plans/stress/stress-test"

const SAFE = 0.95
const SHAKY = 0.8

export function stressVerdict(rate: number): { text: string; tone: string } {
  if (rate >= SAFE) return { text: "Survives almost every historical market", tone: "text-success" }
  if (rate >= SHAKY) return { text: "Survives most historical markets, but not the worst ones", tone: "text-warning" }
  return { text: "Runs out of money in many historical markets", tone: "text-error" }
}

function Stat({ label, value, hint, isHidden }: { label: string; value: string; hint?: string; isHidden?: boolean }) {
  return (
    <div title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground" style={isHidden ? { filter: "blur(6px)" } : undefined}>
        {value}
      </p>
    </div>
  )
}

/** Headline: how often the plan lasts, typical and bad endings, and the worst start year. */
export function StressSummary({ summary, isHidden }: { summary: Summary; isHidden: boolean }) {
  const { successRate, cohorts, worst } = summary
  const verdict = stressVerdict(successRate)
  const failed = cohorts.length - Math.round(successRate * cohorts.length)
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div>
        <p className={`text-4xl font-semibold tabular-nums ${verdict.tone}`}>{fmtSuccess(successRate)}</p>
        <p className="text-[11px] text-foreground-muted">
          of {cohorts.length} historical periods last to the end of the plan
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className={`text-sm font-medium ${verdict.tone}`}>
          {verdict.text}
          {failed > 0 && <span className="text-foreground-muted font-normal"> · runs out in {failed}</span>}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Median ending net worth" value={fmtCompact(summary.medianEnd)} hint="Half of historical periods end above this (today's dollars)" isHidden={isHidden} />
          <Stat label="Bad case (10th pct)" value={fmtCompact(summary.p10End)} hint="9 in 10 historical periods end above this (today's dollars)" isHidden={isHidden} />
          {worst && (
            <Stat
              label="Worst start year"
              value={worst.depletedAge !== null ? `${worst.year} · runs out at ${worst.depletedAge}` : `${worst.year} · ends at ${fmtCompact(worst.netWorth.at(-1) ?? 0)}`}
              isHidden={isHidden && worst.depletedAge === null}
            />
          )}
        </div>
      </div>
    </div>
  )
}
