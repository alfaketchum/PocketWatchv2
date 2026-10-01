"use client"

import { useMemo } from "react"
import { fmtSuccess } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { summarize } from "@/lib/plans/stress/stress-test"
import { stressVerdict } from "./stress-summary"
import { useStressTest } from "./use-stress-test"

/** Overview's one-line stress result (every historical start year, from today), linking to the full tab. */
export function StressOverviewCard({ doc, onOpen }: { doc: PlanDocument; onOpen: () => void }) {
  const { cohorts, loading } = useStressTest(doc, "start")
  const summary = useMemo(() => (cohorts ? summarize(cohorts, null) : null), [cohorts])
  const verdict = summary && summary.cohorts.length > 0 ? stressVerdict(summary.successRate) : null
  return (
    <FireSectionCard
      eyebrow="How safe is this plan?"
      right={
        <button type="button" onClick={onOpen} className="btn-secondary text-xs">
          Open stress test
        </button>
      }
    >
      {loading || !summary ? (
        <div className="h-12 animate-shimmer rounded-xl" />
      ) : !verdict ? (
        <p className="text-sm text-foreground-muted">Not enough market history for a plan this long; try the stress test from retirement.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
          <p className={`text-3xl font-semibold tabular-nums ${verdict.tone}`}>{fmtSuccess(summary.successRate)}</p>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${verdict.tone}`}>{verdict.text}</p>
            <p className="text-xs text-foreground-muted">
              Your whole plan replayed through {summary.cohorts.length} historical start years since 1871.
            </p>
          </div>
        </div>
      )}
    </FireSectionCard>
  )
}
