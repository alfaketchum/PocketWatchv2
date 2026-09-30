"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import type { PlanSummary } from "@/lib/plans/plan-types"

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-error" : "text-foreground"
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-foreground-muted">{sub}</p>}
    </div>
  )
}

/** Headline numbers, always in today's dollars. */
export function PlanSummaryStrip({ summary, isHidden }: { summary: PlanSummary; isHidden: boolean }) {
  const blur = isHidden ? { filter: "blur(8px)" } : undefined
  const lasts = summary.depletedAge === null
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-card border border-card-border rounded-2xl p-5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <Stat
        label="Retire"
        value={summary.retirementAge === null ? "—" : `Age ${summary.retirementAge}`}
        sub={summary.retirementYear === null ? "No retirement milestone" : String(summary.retirementYear)}
      />
      <div style={blur}>
        <Stat
          label="Net worth at retirement"
          value={summary.netWorthAtRetirement === null ? "—" : fmtCompact(summary.netWorthAtRetirement)}
          sub="today's dollars"
        />
      </div>
      <Stat
        label="Money lasts"
        value={lasts ? `Past ${summary.endAge}` : `Until ${summary.depletedAge}`}
        sub={lasts ? "through the end of the plan" : `runs out in ${summary.depletedYear}`}
        tone={lasts ? "good" : "bad"}
      />
      <div style={blur}>
        <Stat
          label={`Net worth at ${summary.endAge}`}
          value={fmtCompact(summary.endingNetWorth)}
          sub={`${fmtCompact(summary.lifetimeTaxes)} lifetime taxes`}
        />
      </div>
    </div>
  )
}
