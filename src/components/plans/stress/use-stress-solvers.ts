"use client"

import { useEffect, useMemo, useState } from "react"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import { isSimulated, type SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import { SOLVER_KEYS, solverApplies, type SolverKey, type SolverResult, type StressGoal } from "@/lib/plans/stress/stress-solvers"
import type { StressInflation } from "@/lib/plans/stress/stress-test"
import { runSolve } from "./stress-solve-client"
import { IMPACT_TRIALS } from "./use-stress-impacts"

/** Most solvers at once (each is a worker running trials flat out); one core is left for the page. */
const MAX_PARALLEL = 4

const parallelism = () => Math.max(1, Math.min(MAX_PARALLEL, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 2) - 1))

interface Args {
  doc: PlanDocument
  annual: AnnualHistory | null
  anchor: number | null
  inflation: StressInflation
  sampling: SamplingOptions
  target: number
  goal: StressGoal
  /** Start only once the main run is done, so it isn't slowed down. */
  enabled: boolean
}

export interface SolverRow {
  key: SolverKey
  /** Candidates tried so far, while it's solving. */
  steps: number
  /** Undefined while solving. */
  result?: SolverResult
}

/**
 * The solvers that apply to this plan, run in parallel workers on the same smaller set of simulated trials as What
 * would help. Results arrive as each finishes; a change to the plan, settings or target starts over.
 */
export function useStressSolvers({ doc, annual, anchor, inflation, sampling, target, goal, enabled }: Args) {
  const { method, trials, blockLength, seed } = sampling
  const keys = useMemo(() => SOLVER_KEYS.filter((k) => solverApplies(doc, k)), [doc])
  const [state, setState] = useState<{ doc: PlanDocument; target: number; goal: StressGoal; rows: SolverRow[] } | null>(null)
  const current = (s: typeof state) => !!s && s.doc === doc && s.target === target && s.goal === goal
  const blank = useMemo(() => keys.map((key) => ({ key, steps: 0 })), [keys])
  const rows = current(state) ? state!.rows : blank

  useEffect(() => {
    if (!enabled || !annual || anchor === null || keys.length === 0) return
    const sample = { method, blockLength, seed, trials: isSimulated(method) ? Math.min(IMPACT_TRIALS, trials) : trials }
    const patch = (key: SolverKey, change: Partial<SolverRow>) =>
      setState((s) => (current(s) ? { ...s!, rows: s!.rows.map((r) => (r.key === key ? { ...r, ...change } : r)) } : s))
    setState({ doc, target, goal, rows: keys.map((key) => ({ key, steps: 0 })) })
    const cancels: (() => void)[] = []
    const queue = [...keys]
    let stopped = false
    const next = () => {
      const key = queue.shift()
      if (stopped || !key) return
      cancels.push(
        runSolve(
          { key, doc, annual, anchor, inflation, sampling: sample, target, goal },
          {
            onStep: (steps) => patch(key, { steps }),
            onDone: (result) => {
              if (result) patch(key, { result })
              else setState((s) => (s && s.doc === doc ? { ...s, rows: s.rows.filter((r) => r.key !== key) } : s))
              next()
            },
          },
        ),
      )
    }
    for (let i = 0; i < parallelism(); i++) next()
    return () => {
      stopped = true
      cancels.forEach((c) => c())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `current` only reads doc, target and goal, listed here.
  }, [enabled, annual, anchor, inflation, method, trials, blockLength, seed, target, goal, keys, doc])

  return rows
}
