"use client"

import { fmtCompact } from "@/components/fire/fire-helpers"
import type { LoanOutcome } from "@/lib/plans/plan-loan-compare"
import { optionLabel } from "@/lib/plans/plan-loan-options"
import type { LoanStress } from "./use-loan-stress"

const pct = (v: number) => `${Math.round(v * 100)}%`

/** How each option did across history's market periods, against the plan as it is. */
export function LoanStressTable({ outcomes, stress, running, isHidden }: { outcomes: LoanOutcome[]; stress: LoanStress[] | null; running: boolean; isHidden: boolean }) {
  if (!stress || stress.length !== outcomes.length) {
    return <div className="h-32 animate-shimmer rounded-xl" aria-label="Replaying history" />
  }
  const head = "px-3 py-2 font-semibold text-right whitespace-nowrap"
  const num = "px-3 py-2 text-right tabular-nums whitespace-nowrap"
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto -mx-5 sm:-mx-6" style={{ filter: isHidden ? "blur(8px)" : undefined, opacity: running ? 0.6 : 1 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="px-3 py-2 font-semibold text-left">Option</th>
              <th className={head}>Money lasted</th>
              <th className={head}>Ended ahead of plan</th>
              <th className={head}>Bad period (10th pct)</th>
              <th className={head}>Typical</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.map((o, i) => (
              <tr key={i} className="border-t border-card-border">
                <td className="px-3 py-2 whitespace-nowrap">{optionLabel(o.option)}</td>
                <td className={num}>{pct(stress[i].success)}</td>
                <td className={num}>{stress[i].beatsPlanned === null ? "—" : `${pct(stress[i].beatsPlanned!)} of periods`}</td>
                <td className={num}>{fmtCompact(stress[i].p10)}</td>
                <td className={num}>{fmtCompact(stress[i].median)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-muted">
        Each option replayed through all {stress[0].periods} complete periods of US market history from today, with that period&apos;s actual inflation.
        Net worth at the end in today&apos;s dollars, home included.
      </p>
    </div>
  )
}
