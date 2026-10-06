/// <reference lib="webworker" />
/** Runs one stress test solver off the main thread (a solver re-runs the trials many times), reporting each step. */

import { solve, type SolveRequest, type SolverResult } from "./stress-solvers"

export type SolveMessage = { type: "step"; done: number } | { type: "result"; result: SolverResult | null }

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<{ request: SolveRequest }>) => {
  let done = 0
  const result = solve(event.data.request, () => scope.postMessage({ type: "step", done: ++done } satisfies SolveMessage))
  scope.postMessage({ type: "result", result } satisfies SolveMessage)
}
