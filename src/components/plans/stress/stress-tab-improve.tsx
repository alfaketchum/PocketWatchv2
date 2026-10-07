"use client"

import { FireSectionCard } from "@/components/fire/fire-section-card"
import { applyChange } from "@/lib/plans/stress/stress-solvers"
import { StressImpactsTable } from "./stress-impacts-table"
import { changeLabel, StressSolversCard } from "./stress-solvers-card"
import type { StressViewModel } from "./stress-view-model"
import { IMPACT_TRIALS } from "./use-stress-impacts"

const IMPACTS_INFO =
  "Your plan run again with one change at a time, through the same markets, to show which levers matter most: moving crypto into stocks and bonds, spending less, skipping a big purchase still ahead, selling a home if the portfolio is depleted, or retiring later. Only the changes that fit your plan are tried. They use a smaller set of the simulated markets so they finish in seconds, and your plan as it is runs on that same set, so compare against that row. Nothing in your plan changes."

/** Improve: how far each lever has to move to reach the target, then what each one change does on its own. */
export function StressTabImprove({ v }: { v: StressViewModel }) {
  return (
    <div className="space-y-5">
      <StressSolversCard
        rows={v.solvers}
        target={v.target}
        onTarget={v.setTarget}
        goal={v.goal}
        onGoal={v.setGoal}
        onApply={(r) => v.update((d) => applyChange(d, r.change), { undoLabel: changeLabel(r) })}
      />
      {v.impacts.available && (
        <FireSectionCard eyebrow="What would help" title="How each change moves the success rate" info={IMPACTS_INFO}>
          <StressImpactsTable
            goal={v.goal}
            results={v.impacts.results}
            total={v.impacts.total}
            unit={v.unit}
            sampleSize={v.simulated ? Math.min(IMPACT_TRIALS, v.sampling.trials) : v.summary.cohorts.length}
            onApply={(key) => {
              const change = v.impacts.variants.get(key)
              if (change) v.update(change.apply, { undoLabel: change.label.toLowerCase() })
            }}
          />
        </FireSectionCard>
      )}
    </div>
  )
}
