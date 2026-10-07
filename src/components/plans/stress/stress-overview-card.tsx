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
import { stressVerdict, VERDICT_TONE_CLASS } from "@/lib/plans/stress/stress-verdict"
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
  const early = summary ? summary.cohorts.filter((c) => c.homeSales?.some((s) => s.plannedAge !== undefined)).length : 0
  const verdict = summary && summary.cohorts.length > 0 ? stressVerdict(summary.successRate, summary.netWorthRate) : null
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
    <FireSectionCard eyebrow="Stress test results" right={details}>
      {runId !== null && (
        <div className="mb-3">
          <StressRunAnimation
            key={`chart-${runId}`}
            trials={live?.trials ?? cohorts ?? []}
            total={live?.total ?? cohorts?.length ?? 0}
            plan={plan}
            complete={!live}
            onFinished={() => setFinishedRun(runId)}
            unit="markets"
            height={96}
            done={!animating}
          />
        </div>
      )}
      {animating ? null : loading || !summary ? (
        <div className="h-12 animate-shimmer rounded-xl" />
      ) : !verdict ? (
        <p className="text-sm text-foreground-muted">Couldn&apos;t run this plan through simulated markets.</p>
      ) : (
        <div key={`numbers-${runId ?? 0}`} className="animate-scale-in flex flex-wrap items-end gap-x-6 gap-y-1">
          <div>
            <p className={`text-3xl font-semibold tabular-nums ${VERDICT_TONE_CLASS[verdict.tone]}`}>{fmtSuccess(summary.netWorthRate)}</p>
            <p className="text-[11px] text-foreground-muted">solvent</p>
          </div>
          <div>
            <p className={`text-xl font-semibold tabular-nums ${summary.successRate >= summary.netWorthRate - 1e-9 ? "text-foreground" : "text-warning"}`}>{fmtSuccess(summary.successRate)}</p>
            <p className="text-[11px] text-foreground-muted">fully funded</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${VERDICT_TONE_CLASS[verdict.tone]}`}>{verdict.text}</p>
            <p className="text-xs text-foreground-muted">
              {isBasic
                ? `Your whole plan run through ${summary.cohorts.length.toLocaleString()} markets built from real history since 1871.`
                : `Your whole plan through ${summary.cohorts.length.toLocaleString()} simulated markets (${DEFAULT_SAMPLING.blockLength}-year blocks of history since 1871).`}
              {!isBasic && summary.spendingDip && ` Your spending rule cut spending to ${fmtPct(summary.spendingDip.worst10, 0)} of plan in the worst 10% of them.`}
              {early > 0 && ` Includes selling a home sooner than planned in ${early.toLocaleString()} of them, when the portfolio was depleted first.`}
            </p>
          </div>
        </div>
      )}
    </FireSectionCard>
  )
}
