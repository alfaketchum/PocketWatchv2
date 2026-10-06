/// <reference lib="webworker" />
/** Runs a stress test's trials off the main thread (1,000 simulated trials take seconds), reporting progress per chunk. */

import { STRESS_CHUNK, stressRunner, type StressRunMessage, type StressRunRequest } from "./stress-run"
import type { CohortResult } from "./stress-test"

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<{ id: number; request: StressRunRequest }>) => {
  const { id, request } = event.data
  const { total, run } = stressRunner(request)
  const cohorts: CohortResult[] = []
  const post = (message: StressRunMessage) => scope.postMessage(message)
  for (let from = 0; from < total; from += STRESS_CHUNK) {
    run(from, from + STRESS_CHUNK, cohorts)
    post({ id, type: "progress", done: cohorts.length, total, chunk: cohorts.slice(from) })
  }
  post({ id, type: "result", cohorts })
}
