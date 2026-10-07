"use client"

import { fmtCompact, fmtPct, fmtSuccess } from "@/components/fire/fire-helpers"
import { sequenceLabel } from "@/lib/plans/stress/stress-labels"
import type { StressSummary as Summary } from "@/lib/plans/stress/stress-test"
import { stressVerdict, VERDICT_TONE_CLASS } from "@/lib/plans/stress/stress-verdict"

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

/**
 * The headline, net worth first: how often the plan stays solvent (the big number), how often it's fully funded beside it,
 * and the verdict. Always above the stress test's tabs.
 */
export function StressHeadline({ summary, simulated }: { summary: Summary; simulated: boolean }) {
  const { successRate, netWorthRate, cohorts } = summary
  const unit = simulated ? "simulated trials" : "historical periods"
  const verdict = stressVerdict(successRate, netWorthRate, simulated ? "markets" : "historical markets")
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div className="flex items-end gap-6">
        <div>
          <p className={`text-4xl font-semibold tabular-nums ${VERDICT_TONE_CLASS[verdict.tone]}`}>{fmtSuccess(netWorthRate)}</p>
          <p className="text-[11px] text-foreground-muted">solvent</p>
        </div>
        <div>
          <p className={`text-2xl font-semibold tabular-nums ${successRate >= netWorthRate - 1e-9 ? "text-foreground" : "text-warning"}`}>{fmtSuccess(successRate)}</p>
          <p className="text-[11px] text-foreground-muted">fully funded</p>
        </div>
      </div>
      <p className={`min-w-0 flex-1 pb-1 text-sm font-medium ${VERDICT_TONE_CLASS[verdict.tone]}`}>
        {verdict.text}
        <span className="font-normal text-foreground-muted"> · {cohorts.length.toLocaleString()} {unit}</span>
      </p>
    </div>
  )
}

/** Typical and bad endings, the spending rule's lowest point and the worst trial: the Summary tab's first row. */
export function StressStats({ summary, simulated, isHidden }: { summary: Summary; simulated: boolean; isHidden: boolean }) {
  const { worst } = summary
  const unit = simulated ? "simulated trials" : "historical periods"
  const worstText = (c: NonNullable<typeof worst>) =>
    c.brokeAge !== undefined
      ? `assets exhausted at ${c.brokeAge}`
      : c.depletedAge !== null
        ? `portfolio depleted at ${c.depletedAge}, net worth ${fmtCompact(c.netWorth.at(-1) ?? 0)}`
        : `${fmtCompact(c.netWorth.at(-1) ?? 0)} net worth`
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 [&>*:nth-child(odd):last-child]:col-span-2 sm:[&>*:nth-child(odd):last-child]:col-span-1">
      <Stat label="Net worth · median" value={fmtCompact(summary.medianEnd)} hint={`Accounts plus your home and other property, minus debts, at the end: half of the ${unit} end above this (today's dollars)`} isHidden={isHidden} />
      <Stat label="Net worth · bad case" value={fmtCompact(summary.p10End)} hint={`9 in 10 ${unit} end with more net worth than this (10th percentile, today's dollars)`} isHidden={isHidden} />
      <Stat label="Accounts · median" value={fmtCompact(summary.medianEndInvested)} hint={`Money left in your accounts at the end, what pays the bills: half of the ${unit} end above this (today's dollars)`} isHidden={isHidden} />
      {summary.spendingDip && (
        <Stat
          label="Lowest spending"
          value={`${fmtPct(summary.spendingDip.worst10, 0)} of plan`}
          hint={`How far the spending rule cut flexible spending: in the worst 10% of ${unit} it fell to this share of plan at some point (median ${fmtPct(summary.spendingDip.median, 0)})`}
          isHidden={false}
        />
      )}
      {worst && (
        <Stat
          label={simulated ? "Worst trial" : "Worst start year"}
          value={`${simulated ? sequenceLabel(worst.sequence, 1) : worst.year} · ${worstText(worst)}`}
          hint={simulated ? sequenceLabel(worst.sequence) : undefined}
          isHidden={isHidden && worst.brokeAge === undefined}
        />
      )}
    </div>
  )
}
