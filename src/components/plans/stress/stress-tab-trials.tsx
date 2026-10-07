"use client"

import { FireSectionCard } from "@/components/fire/fire-section-card"
import { StressCohortBars } from "./stress-cohort-bars"
import { StressPeriodsTable } from "./stress-periods-table"
import { StressTrialsTable } from "./stress-trials-table"
import type { StressViewModel } from "./stress-view-model"

/** Trials: every trial worst first; in the historical replay, each start year's ending and the crisis starts too. */
export function StressTabTrials({ v }: { v: StressViewModel }) {
  return (
    <div className="space-y-5">
      <FireSectionCard
        eyebrow={v.simulated ? "Every trial" : "Every start year"}
        title="Worst first"
        info="The historical years each one lived through (runs of consecutive years), net worth at retirement, your net worth and what was left in your accounts at the end (today's dollars), and how it ended."
      >
        <StressTrialsTable key={`${v.sampling.method}-${v.sampling.seed}`} cohorts={v.summary.cohorts} yardsticks={v.yardsticks} retirementIndex={v.retirementIndex} isHidden={v.isHidden} />
      </FireSectionCard>
      {!v.simulated && (
        <div className="grid gap-5 xl:grid-cols-2">
          <FireSectionCard eyebrow="By start year" title="Ending net worth" info="One bar per historical start year: amber where the cash ran out, red where it went broke.">
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
