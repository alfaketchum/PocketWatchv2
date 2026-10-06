"use client"

import { STRESS_CHUNK, stressRunner, type StressRunMessage, type StressRunRequest } from "@/lib/plans/stress/stress-run"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

export interface Handlers {
  onChunk: (chunk: CohortResult[], total: number) => void
  onDone: (cohorts: CohortResult[]) => void
}

/** Runs the trials in a Web Worker (falling back to the main thread if it fails to start); returns a cancel function. */
function runInWorker(request: StressRunRequest, h: Handlers): () => void {
  const worker = new Worker(new URL("../../../lib/plans/stress/stress.worker.ts", import.meta.url), { type: "module" })
  let cancelFallback = () => {}
  worker.onerror = (event) => {
    console.error("Stress test worker failed; running on the main thread", event.message)
    worker.terminate()
    cancelFallback = runInSlices(request, h)
  }
  worker.onmessage = (event: MessageEvent<StressRunMessage>) => {
    const message = event.data
    if (message.type === "progress") h.onChunk(message.chunk, message.total)
    else {
      h.onDone(message.cohorts)
      worker.terminate()
    }
  }
  worker.postMessage({ id: 0, request })
  return () => {
    worker.terminate()
    cancelFallback()
  }
}

/** Fallback without workers: small slices on the main thread, so the page stays responsive. */
function runInSlices(request: StressRunRequest, h: Handlers): () => void {
  const { total, run } = stressRunner(request)
  const out: CohortResult[] = []
  let timer: ReturnType<typeof setTimeout>
  const step = (from: number) => {
    run(from, from + STRESS_CHUNK, out)
    h.onChunk(out.slice(from), total)
    if (out.length < total) timer = setTimeout(() => step(out.length), 0)
    else h.onDone(out)
  }
  timer = setTimeout(() => step(0), 0)
  return () => clearTimeout(timer)
}

/** Runs a stress test off the main thread when workers are available; returns a cancel function. */
export function runStress(request: StressRunRequest, h: Handlers): () => void {
  return typeof Worker === "undefined" ? runInSlices(request, h) : runInWorker(request, h)
}
