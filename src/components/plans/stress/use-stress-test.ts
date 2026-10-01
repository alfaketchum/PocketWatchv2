"use client"

import { useEffect, useMemo, useState } from "react"
import { useFireHistoryData } from "@/hooks/finance/use-fire-baseline"
import { annualHistory } from "@/lib/plans/stress/stress-history"
import { anchorIndex, cohortStarts, runCohort, type CohortResult, type StressAlign } from "@/lib/plans/stress/stress-test"
import type { PlanDocument } from "@/lib/plans/plan-types"

/** Wait for edits to settle before replaying history. */
const DEBOUNCE_MS = 350
/** Cohorts per slice (~5 ms each), so the page stays responsive while ~100 run. */
const BATCH = 8

/**
 * Every complete historical cohort for the plan, run in small slices after edits settle. The last results
 * stay on screen while a new run is in progress.
 */
export function useStressTest(doc: PlanDocument, align: StressAlign) {
  const history = useFireHistoryData()
  const annual = useMemo(() => (history.data ? annualHistory(history.data) : null), [history.data])
  const anchor = useMemo(() => anchorIndex(doc, align), [doc, align])
  const [cohorts, setCohorts] = useState<CohortResult[] | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!annual || anchor === null) return
    const starts = cohortStarts(doc, annual, anchor)
    const out: CohortResult[] = []
    let next = 0
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      setRunning(true)
      const end = Math.min(starts.length, next + BATCH)
      for (; next < end; next++) out.push(runCohort(doc, annual, starts[next], anchor))
      if (next < starts.length) {
        timer = setTimeout(step, 0)
        return
      }
      setCohorts(out)
      setRunning(false)
    }
    timer = setTimeout(step, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [doc, annual, anchor])

  return { annual, anchor, cohorts, running, loading: history.isLoading, error: history.isError }
}
