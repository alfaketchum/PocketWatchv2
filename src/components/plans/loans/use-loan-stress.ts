"use client"

import { useEffect, useMemo, useState } from "react"
import { useFireHistoryData } from "@/hooks/finance/use-fire-baseline"
import { annualHistory } from "@/lib/plans/stress/stress-history"
import { cohortStarts, percentile, runCohort } from "@/lib/plans/stress/stress-test"
import type { PlanDocument } from "@/lib/plans/plan-types"

/** Wait for edits to settle before replaying history. */
const DEBOUNCE_MS = 400
/** Cohorts per slice (~5 ms each), so the page stays responsive. */
const BATCH = 8
const P10 = 0.1

export interface LoanStress {
  /** Share of historical periods in which the money lasted. */
  success: number
  /** Ending net worth (today's dollars) in a bad period (10th percentile) and a typical one. */
  p10: number
  median: number
  /** Share of periods in which it ended with more than the plan as it is (null for the plan itself). */
  beatsPlanned: number | null
  periods: number
}

/**
 * Each option (option 0 = the plan as it is) replayed through every complete historical period from today,
 * with history's actual inflation: a fixed-rate loan gets cheaper in real terms when inflation runs hot.
 */
export function useLoanStress(docs: PlanDocument[]) {
  const history = useFireHistoryData()
  const annual = useMemo(() => (history.data ? annualHistory(history.data) : null), [history.data])
  const [result, setResult] = useState<LoanStress[] | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!annual || docs.length === 0) return
    const starts = cohortStarts(docs[0], annual, 0)
    const jobs = docs.flatMap((doc, d) => starts.map((start) => ({ d, doc, start })))
    const ends: number[][] = docs.map(() => [])
    const lasted: number[] = docs.map(() => 0)
    let next = 0
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      setRunning(true)
      const end = Math.min(jobs.length, next + BATCH)
      for (; next < end; next++) {
        const { d, doc, start } = jobs[next]
        const cohort = runCohort(doc, annual, start, 0, "history")
        ends[d].push(cohort.netWorth[cohort.netWorth.length - 1] ?? 0)
        if (cohort.depletedAge === null) lasted[d]++
      }
      if (next < jobs.length) {
        timer = setTimeout(step, 0)
        return
      }
      setResult(
        ends.map((e, d) => ({
          success: e.length ? lasted[d] / e.length : 0,
          p10: percentile(e, P10),
          median: percentile(e, 0.5),
          beatsPlanned: d === 0 ? null : e.filter((v, i) => v > ends[0][i]).length / Math.max(1, e.length),
          periods: e.length,
        })),
      )
      setRunning(false)
    }
    timer = setTimeout(step, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [docs, annual])

  return { result, running, loading: history.isLoading, error: history.isError }
}
