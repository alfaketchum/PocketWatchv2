"use client"

import { useEffect, useMemo, useState } from "react"
import { useFireHistoryData } from "@/hooks/finance/use-fire-baseline"
import { annualHistory } from "@/lib/plans/stress/stress-history"
import type { StressRunRequest } from "@/lib/plans/stress/stress-run"
import { DEFAULT_SAMPLING, type SamplingOptions, type StressSampling } from "@/lib/plans/stress/stress-sampling"
import { anchorIndex, type CohortResult, type StressAlign, type StressInflation } from "@/lib/plans/stress/stress-test"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { runStress, type Handlers } from "./stress-run-client"

/** Wait for edits to settle before running. */
const DEBOUNCE_MS = 350
/** How often trials that have finished are handed to the page while a run is in progress. */
const LIVE_MS = 250

/** A run in progress: the trials finished so far (for the live animation) out of how many. */
export interface StressLive {
  /** Increases with every run, so a new run restarts its animation. */
  runId: number
  trials: CohortResult[]
  total: number
}

/**
 * The plan's stress test trials (every complete historical cohort, or simulated trials), run off the main thread
 * after edits settle (no doc: nothing runs). A new `nonce` runs it again with the same inputs. The last results stay on screen while a new run is in progress.
 */
export function useStressTest(doc: PlanDocument | null, align: StressAlign, inflation: StressInflation, sampling: SamplingOptions = DEFAULT_SAMPLING, nonce = 0) {
  const history = useFireHistoryData(doc !== null)
  const annual = useMemo(() => (history.data ? annualHistory(history.data) : null), [history.data])
  // Simulated trials always start from the plan's first year; lining up with retirement is for the plain replay.
  const anchor = useMemo(() => (doc ? anchorIndex(doc, sampling.method === "history" ? align : "start") : null), [doc, align, sampling.method])
  // The results on screen and the method that made them (a new run keeps showing the last results until it's done).
  const [result, setResult] = useState<{ cohorts: CohortResult[]; method: StressSampling; runId: number } | null>(null)
  const [live, setLive] = useState<StressLive | null>(null)
  const { method, trials, blockLength, seed } = sampling

  useEffect(() => {
    if (!doc || !annual || anchor === null) return
    const request: StressRunRequest = { doc, annual, anchor, inflation, sampling: { method, trials, blockLength, seed } }
    let cancel = () => {}
    // Finished trials reach the page a few times a second, not per chunk: each update re-renders the page.
    let pending: CohortResult[] = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const timer = setTimeout(() => {
      const runId = Date.now()
      setLive({ runId, trials: [], total: 0 })
      const flush = (total: number) => {
        flushTimer = null
        const chunk = pending
        pending = []
        setLive((l) => (l && l.runId === runId ? { runId, trials: [...l.trials, ...chunk], total } : l))
      }
      const handlers: Handlers = {
        onChunk: (chunk, total) => {
          pending = pending.concat(chunk)
          if (flushTimer === null) flushTimer = setTimeout(() => flush(total), LIVE_MS)
        },
        onDone: (out) => {
          if (flushTimer !== null) clearTimeout(flushTimer)
          setResult({ cohorts: out, method, runId })
          setLive(null)
        },
      }
      cancel = runStress(request, handlers)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      if (flushTimer !== null) clearTimeout(flushTimer)
      cancel()
    }
  }, [doc, annual, anchor, inflation, method, trials, blockLength, seed, nonce])

  return { annual, anchor, cohorts: result?.cohorts ?? null, method: result?.method ?? method, runId: live?.runId ?? result?.runId ?? null, running: live !== null, live, loading: history.isLoading, error: history.isError }
}
