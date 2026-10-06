"use client"

import { solve, type SolveRequest, type SolverResult } from "@/lib/plans/stress/stress-solvers"
import type { SolveMessage } from "@/lib/plans/stress/stress-solve.worker"

export interface SolveHandlers {
  onStep: (done: number) => void
  onDone: (result: SolverResult | null) => void
}

/** Without workers: the whole solve on the main thread, after a beat so the page paints first. */
function solveHere(request: SolveRequest, h: SolveHandlers): () => void {
  let done = 0
  const timer = setTimeout(() => h.onDone(solve(request, () => h.onStep(++done))), 0)
  return () => clearTimeout(timer)
}

/** Runs one solver in a Web Worker (on the main thread if workers aren't available or fail); returns a cancel function. */
export function runSolve(request: SolveRequest, h: SolveHandlers): () => void {
  if (typeof Worker === "undefined") return solveHere(request, h)
  const worker = new Worker(new URL("../../../lib/plans/stress/stress-solve.worker.ts", import.meta.url), { type: "module" })
  let cancelFallback = () => {}
  worker.onerror = (event) => {
    console.error("Stress solver worker failed; solving on the main thread", event.message)
    worker.terminate()
    cancelFallback = solveHere(request, h)
  }
  worker.onmessage = (event: MessageEvent<SolveMessage>) => {
    const message = event.data
    if (message.type === "step") h.onStep(message.done)
    else {
      h.onDone(message.result)
      worker.terminate()
    }
  }
  worker.postMessage({ request })
  return () => {
    worker.terminate()
    cancelFallback()
  }
}
