/**
 * Running a stress test's trials, shared by the Web Worker (stress.worker.ts) and the main-thread fallback: the
 * request a run needs and a chunked loop over its paths.
 */

import type { PlanDocument } from "../plan-types"
import type { AnnualHistory } from "./stress-history"
import type { SamplingOptions } from "./stress-sampling"
import { runPath, stressPaths, type CohortResult, type StressInflation } from "./stress-test"

export interface StressRunRequest {
  doc: PlanDocument
  annual: AnnualHistory
  anchor: number
  inflation: StressInflation
  sampling: SamplingOptions
}

/** Messages from the worker: each chunk of finished trials as it's done (for the live view), then every result. */
export type StressRunMessage =
  | { id: number; type: "progress"; done: number; total: number; chunk: CohortResult[] }
  | { id: number; type: "result"; cohorts: CohortResult[] }

/** Trials per chunk: about a quarter second of work between progress reports (or yields to the page). */
export const STRESS_CHUNK = 50

/** A run's paths and a function that runs trials `from` up to `to` into `out`. */
export function stressRunner(req: StressRunRequest) {
  const paths = stressPaths(req.doc, req.annual, req.anchor, req.sampling)
  const simulated = req.sampling.method !== "history"
  const run = (from: number, to: number, out: CohortResult[]) => {
    for (let i = from; i < Math.min(to, paths.length); i++) {
      out.push(runPath(req.doc, req.annual, paths[i], req.anchor, req.inflation, simulated ? i : undefined))
    }
  }
  return { total: paths.length, run }
}
