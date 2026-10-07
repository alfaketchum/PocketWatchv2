"use client"

import { useEffect, useMemo, useState } from "react"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { impactOf, impactVariants, type ImpactResult } from "@/lib/plans/stress/stress-impacts"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import { isSimulated, type SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import type { StressInflation } from "@/lib/plans/stress/stress-test"
import { runStress } from "./stress-run-client"

/** Simulated trials per what-if: the first of the same markets, enough to rank the changes in seconds. */
export const IMPACT_TRIALS = 250
export const BASELINE_KEY = "baseline"
const NO_RESULTS: ImpactResult[] = []

interface Args {
  doc: PlanDocument
  annual: AnnualHistory | null
  anchor: number | null
  inflation: StressInflation
  sampling: SamplingOptions
  /** Start only once the main run is done, so it isn't slowed down. */
  enabled: boolean
}

/**
 * The plan and each what-if change run one after another through the same markets (a smaller set of simulated
 * trials), off the main thread. Results arrive as each finishes; a change to the plan or settings starts over.
 */
export function useStressImpacts({ doc, annual, anchor, inflation, sampling, enabled }: Args) {
  const { method, trials, blockLength, seed } = sampling
  const runs = useMemo(() => [{ key: BASELINE_KEY, label: "Your plan as it is", doc }, ...impactVariants(doc)], [doc])
  const [state, setState] = useState<{ runs: typeof runs; results: ImpactResult[] } | null>(null)
  const results = state && state.runs === runs ? state.results : NO_RESULTS

  useEffect(() => {
    if (!enabled || !annual || anchor === null || runs.length < 2) return
    const sample = { method, blockLength, seed, trials: isSimulated(method) ? Math.min(IMPACT_TRIALS, trials) : trials }
    let cancel = () => {}
    let stopped = false
    setState({ runs, results: [] })
    const next = (i: number) => {
      if (stopped || i >= runs.length) return
      const run = runs[i]
      cancel = runStress(
        { doc: run.doc, annual, anchor, inflation, sampling: sample },
        {
          onChunk: () => {},
          onDone: (cohorts) => {
            setState((s) => (s && s.runs === runs ? { runs, results: [...s.results, impactOf(run.key, run.label, cohorts)] } : s))
            next(i + 1)
          },
        },
      )
    }
    next(0)
    return () => {
      stopped = true
      cancel()
    }
  }, [enabled, annual, anchor, inflation, method, trials, blockLength, seed, runs])

  const variants = useMemo(() => new Map(runs.flatMap((r) => ("apply" in r ? [[r.key, r] as const] : []))), [runs])
  return useMemo(() => ({ results, total: runs.length, available: runs.length > 1, variants }), [results, runs.length, variants])
}
