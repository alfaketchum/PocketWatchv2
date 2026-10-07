/// <reference lib="webworker" />
/** Runs the Roth conversion optimizer off the main thread (a few hundred simulations), reporting each step. */

import type { PlanDocument } from "../plan-types"
import { optimizeRoth, type RothOptimization } from "./roth-optimizer"

export type RothOptimizeMessage = { type: "step"; done: number; total: number } | { type: "result"; result: RothOptimization }

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<{ doc: PlanDocument }>) => {
  const result = optimizeRoth(event.data.doc, (done, total) => scope.postMessage({ type: "step", done, total } satisfies RothOptimizeMessage))
  scope.postMessage({ type: "result", result } satisfies RothOptimizeMessage)
}
