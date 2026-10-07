"use client"

import type { PlanDocument } from "@/lib/plans/plan-types"
import { optimizeRoth, type RothOptimization } from "@/lib/plans/roth/roth-optimizer"
import type { RothOptimizeMessage } from "@/lib/plans/roth/roth-optimize.worker"

export interface OptimizeHandlers {
  onStep: (done: number, total: number) => void
  onDone: (result: RothOptimization) => void
}

/** Without workers: the whole search on the main thread, after a beat so the page paints first. */
function optimizeHere(doc: PlanDocument, h: OptimizeHandlers): () => void {
  const timer = setTimeout(() => h.onDone(optimizeRoth(doc, h.onStep)), 0)
  return () => clearTimeout(timer)
}

/** Runs the optimizer in a Web Worker (on the main thread if workers aren't available or fail); returns a cancel function. */
export function runRothOptimize(doc: PlanDocument, h: OptimizeHandlers): () => void {
  if (typeof Worker === "undefined") return optimizeHere(doc, h)
  const worker = new Worker(new URL("../../../lib/plans/roth/roth-optimize.worker.ts", import.meta.url), { type: "module" })
  let cancelFallback = () => {}
  worker.onerror = (event) => {
    console.error("Roth optimizer worker failed; running on the main thread", event.message)
    worker.terminate()
    cancelFallback = optimizeHere(doc, h)
  }
  worker.onmessage = (event: MessageEvent<RothOptimizeMessage>) => {
    const message = event.data
    if (message.type === "step") h.onStep(message.done, message.total)
    else {
      h.onDone(message.result)
      worker.terminate()
    }
  }
  worker.postMessage({ doc })
  return () => {
    worker.terminate()
    cancelFallback()
  }
}
