"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { fmtPct, fmtSuccess } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { deflator } from "@/lib/plans/plan-dollars"
import { inflationOf } from "@/lib/plans/plan-inflation"
import type { PlanDocument, PlanProjection } from "@/lib/plans/plan-types"
import { DEFAULT_SAMPLING } from "@/lib/plans/stress/stress-sampling"
import { summarize } from "@/lib/plans/stress/stress-test"
import { StressRunAnimation } from "./stress-run-animation"
import { stressVerdict } from "./stress-summary"
import { useStressTest } from "./use-stress-test"

/**
 * Ledger Overview's one-line safety result: the plan through the default simulated markets (the same number the
 * stress test page opens on). Basic gets the sentence and a way into the details; Advanced also names the method.
 */
export function StressOverviewCard({ doc, planId, projection }: { doc: PlanDocument; planId: string; projection: PlanProjection }) {
  const { isBasic, setMode } = usePlanMode()
  const router = useRouter()
  const { cohorts, live, runId, loading } = useStressTest(doc, "start", "plan", DEFAULT_SAMPLING)
  const [finishedRun, setFinishedRun] = useState<number | null>(null)
  const animating = runId !== null && runId !== finishedRun
  const plan = useMemo(() => projection.rows.map((r) => r.netWorth / deflator(inflationOf(doc.settings), r.index, "balance")), [projection, doc.settings])
  const summary = useMemo(() => (cohorts ? summarize(cohorts, null) : null), [cohorts])
  const verdict = summary && summary.cohorts.length > 0 ? stressVerdict(summary.successRate, true) : null
  const href = `/plans/${planId}/stress`
  const details = isBasic ? (
    <button
      type="button"
      className="btn-secondary text-xs"
      onClick={() => {
        setMode("advanced")
        router.push(href)
      }}
    >
      See the details
    </button>
  ) : (
    <Link href={href} className="btn-secondary text-xs">
      Open stress test
    </Link>
  )
  return (
    <FireSectionCard eyebrow="How safe is this plan?" right={details}>
      {animating && runId !== null ? (
        <StressRunAnimation
          key={runId}
          trials={live?.trials ?? cohorts ?? []}
          total={live?.total ?? cohorts?.length ?? 0}
          plan={plan}
          complete={!live}
          onFinished={() => setFinishedRun(runId)}
          unit="markets"
          height={96}
        />
      ) : loading || !summary ? (
        <div className="h-12 animate-shimmer rounded-xl" />
      ) : !verdict ? (
        <p className="text-sm text-foreground-muted">Couldn&apos;t run this plan through simulated markets.</p>
      ) : (
        <div key={runId ?? 0} className="animate-scale-in flex flex-wrap items-end gap-x-6 gap-y-1">
          <p className={`text-3xl font-semibold tabular-nums ${verdict.tone}`}>{fmtSuccess(summary.successRate)}</p>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${verdict.tone}`}>{verdict.text}</p>
            <p className="text-xs text-foreground-muted">
              {isBasic
                ? `Your whole plan run through ${summary.cohorts.length.toLocaleString()} markets built from real history since 1871.`
                : `Your whole plan through ${summary.cohorts.length.toLocaleString()} simulated markets (${DEFAULT_SAMPLING.blockLength}-year blocks of history since 1871).`}
              {!isBasic && summary.spendingDip && ` Your spending rule cut spending to ${fmtPct(summary.spendingDip.worst10, 0)} of plan in the worst 10% of them.`}
            </p>
          </div>
        </div>
      )}
    </FireSectionCard>
  )
}
