"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { RothOptimization } from "@/lib/plans/roth/roth-optimizer"
import { runRothOptimize } from "./roth-optimize-client"

export interface RothOptimizerState {
  running: boolean
  progress: { done: number; total: number } | null
  result: RothOptimization | null
  /** The plan the result was found for; a result for an older version of the plan is stale. */
  forDoc: PlanDocument | null
}

const IDLE: RothOptimizerState = { running: false, progress: null, result: null, forDoc: null }

/** Runs the optimizer on demand; editing the plan doesn't rerun it, but marks the result as out of date. */
export function useRothOptimizer(doc: PlanDocument) {
  const [state, setState] = useState<RothOptimizerState>(IDLE)
  const cancel = useRef<(() => void) | null>(null)

  const run = useCallback(() => {
    cancel.current?.()
    setState({ running: true, progress: null, result: null, forDoc: doc })
    cancel.current = runRothOptimize(doc, {
      onStep: (done, total) => setState((s) => ({ ...s, progress: { done, total } })),
      onDone: (result) => setState({ running: false, progress: null, result, forDoc: doc }),
    })
  }, [doc])

  const stop = useCallback(() => {
    cancel.current?.()
    cancel.current = null
    setState(IDLE)
  }, [])

  useEffect(() => () => cancel.current?.(), [])

  return { ...state, stale: state.forDoc !== null && state.forDoc !== doc, run, stop }
}
