"use client"

import { FireSectionCard } from "@/components/fire/fire-section-card"
import { StressCohortBars } from "./stress-cohort-bars"
import { StressPeriodsTable } from "./stress-periods-table"
import { StressTrialsGroups } from "./stress-trials-groups"
import type { StressViewModel } from "./stress-view-model"

/** Trials: every trial worst first; in the historical replay, each start year's ending and the crisis starts too. */
export function StressTabTrials({ v }: { v: StressViewModel }) {
  return (
    <div className="space-y-5">
      <FireSectionCard
        eyebrow={v.simulated ? "Every trial" : "Every start year"}
        title="Grouped by how they ended, worst first"
        info="Each group is an outcome (the same ones as How it ended, on the view it shows), worst first, with how many trials landed there. Pick one above to see only it. Each row's little line is that trial's net worth by age, on one scale for all of them; open a row for its full path against your plan, the years it lived through and any home it sold."
      >
        <StressTrialsGroups key={`${v.sampling.method}-${v.sampling.seed}`} cohorts={v.summary.cohorts} yardsticks={v.yardsticks} age0={v.age0} planNetWorth={v.planNetWorth} isHidden={v.isHidden} />
      </FireSectionCard>
      {!v.simulated && (
        <div className="grid gap-5 xl:grid-cols-2">
          <FireSectionCard eyebrow="By start year" title="Ending net worth" info="One bar per historical start year: amber where the accounts were depleted, red where assets were exhausted.">
            <StressCohortBars cohorts={v.summary.cohorts} isHidden={v.isHidden} />
          </FireSectionCard>
          <FireSectionCard eyebrow="Worst periods" title="Starting in a crisis">
            <StressPeriodsTable cohorts={v.cohorts ?? []} isHidden={v.isHidden} />
          </FireSectionCard>
        </div>
      )}
    </div>
  )
}
