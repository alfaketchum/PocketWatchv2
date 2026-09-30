"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { PlanListItem } from "@/hooks/plans/shared"
import type { PlanSummary } from "@/lib/plans/plan-types"

interface Metric {
  label: string
  value: (s: PlanSummary) => string
  money?: boolean
}

const METRICS: Metric[] = [
  { label: "Retire", value: (s) => (s.retirementAge === null ? "—" : `Age ${s.retirementAge} (${s.retirementYear})`) },
  { label: "Net worth at retirement", value: (s) => (s.netWorthAtRetirement === null ? "—" : fmtCompact(s.netWorthAtRetirement)), money: true },
  { label: "Money lasts", value: (s) => (s.depletedAge === null ? `Past ${s.endAge}` : `Until ${s.depletedAge}`) },
  { label: "Ending net worth", value: (s) => fmtCompact(s.endingNetWorth), money: true },
  { label: "Lifetime taxes", value: (s) => fmtCompact(s.lifetimeTaxes), money: true },
]

/** Key numbers side by side, in today's dollars. */
export function CompareTable({ plans, colors, isHidden }: { plans: PlanListItem[]; colors: string[]; isHidden: boolean }) {
  return (
    <FireSectionCard eyebrow="Side by side" title="Key numbers, today's dollars">
      <div className="overflow-x-auto -mx-5 sm:-mx-6">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-5 sm:px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-foreground-muted" />
              {plans.map((p, i) => (
                <th key={p.id} className="px-3 py-2 text-right text-xs font-semibold text-foreground whitespace-nowrap">
                  <span className="inline-block h-2 w-2 rounded-sm mr-1.5" style={{ background: colors[i] }} />
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.label} className="border-t border-card-border">
                <td className="px-5 sm:px-6 py-2 text-xs text-foreground-muted whitespace-nowrap">{m.label}</td>
                {plans.map((p) => (
                  <td
                    key={p.id}
                    className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                    style={m.money && isHidden ? { filter: "blur(6px)" } : undefined}
                  >
                    {p.summary ? m.value(p.summary) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FireSectionCard>
  )
}
