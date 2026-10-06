"use client"

import { fmtCompact, fmtPct, fmtSuccess } from "@/components/fire/fire-helpers"
import { sequenceLabel } from "@/lib/plans/stress/stress-labels"
import type { StressSummary as Summary } from "@/lib/plans/stress/stress-test"

const SAFE = 0.95
const SHAKY = 0.8

export function stressVerdict(rate: number, simulated = false): { text: string; tone: string } {
  const markets = simulated ? "markets" : "historical markets"
  if (rate >= SAFE) return { text: `Survives almost every ${simulated ? "simulated market" : "historical market"}`, tone: "text-success" }
  if (rate >= SHAKY) return { text: `Survives most ${markets}, but not the worst ones`, tone: "text-warning" }
  return { text: `Runs out of money in many ${markets}`, tone: "text-error" }
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
export function StressSummary({ summary, simulated, isHidden }: { summary: Summary; simulated: boolean; isHidden: boolean }) {
  const { successRate, cohorts, worst } = summary
  const verdict = stressVerdict(successRate, simulated)
  const unit = simulated ? "simulated trials" : "historical periods"
  const failed = cohorts.length - Math.round(successRate * cohorts.length)
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div>
        <p className={`text-4xl font-semibold tabular-nums ${verdict.tone}`}>{fmtSuccess(successRate)}</p>
        <p className="text-[11px] text-foreground-muted">
          of {cohorts.length.toLocaleString()} {unit} last to the end of the plan
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className={`text-sm font-medium ${verdict.tone}`}>
          {verdict.text}
          {failed > 0 && <span className="text-foreground-muted font-normal"> · runs out in {failed}</span>}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 [&>*:nth-child(odd):last-child]:col-span-2 sm:[&>*:nth-child(odd):last-child]:col-span-1">
          <Stat label="Left in accounts (median)" value={fmtCompact(summary.medianEndInvested)} hint={`Money left in your accounts at the end: half of the ${unit} end above this (today's dollars)`} isHidden={isHidden} />
          <Stat label="Left in accounts (bad case)" value={fmtCompact(summary.p10EndInvested)} hint={`9 in 10 ${unit} end with more than this in your accounts (10th percentile, today's dollars)`} isHidden={isHidden} />
          <Stat label="Net worth at end (median)" value={fmtCompact(summary.medianEnd)} hint={`Accounts plus your home and other property, minus debts: half of the ${unit} end above this (today's dollars)`} isHidden={isHidden} />
          {summary.spendingDip && (
            <Stat
              label="Spending rule: lowest spending"
              value={`${fmtPct(summary.spendingDip.worst10, 0)} of plan`}
              hint={`How far the spending rule cut flexible spending: in the worst 10% of ${unit} it fell to this share of plan at some point (median ${fmtPct(summary.spendingDip.median, 0)})`}
              isHidden={false}
            />
          )}
          {worst && (
            <Stat
              label={simulated ? "Worst trial" : "Worst start year"}
              value={`${simulated ? sequenceLabel(worst.sequence, 1) : worst.year} · ${worst.depletedAge !== null ? `runs out at ${worst.depletedAge}` : `ends with ${fmtCompact(worst.invested.at(-1) ?? 0)} in accounts`}`}
              hint={simulated ? sequenceLabel(worst.sequence) : undefined}
              isHidden={isHidden && worst.depletedAge === null}
            />
          )}
        </div>
      </div>
    </div>
  )
}
