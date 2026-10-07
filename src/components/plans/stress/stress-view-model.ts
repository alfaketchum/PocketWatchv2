import type { PlanProjection } from "@/lib/plans/plan-types"
import type { InsightFix, Insight } from "@/lib/plans/stress/stress-diagnosis"
import type { HistogramSlice } from "@/lib/plans/stress/stress-histogram"
import type { AnnualHistory } from "@/lib/plans/stress/stress-history"
import type { OutcomeYardsticks } from "@/lib/plans/stress/stress-outcomes"
import type { SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import type { StressGoal } from "@/lib/plans/stress/stress-solvers"
import type { CohortResult, StressAlign, StressInflation, StressSummary } from "@/lib/plans/stress/stress-test"
import type { PlanEditorProps } from "../plans-helpers"
import type { Cape } from "./stress-controls"
import type { FanMeasure } from "./stress-fan-chart"
import type { useStressImpacts } from "./use-stress-impacts"
import type { SolverRow } from "./use-stress-solvers"

export type ChartView = "range" | "years"
export type EndingView = "accounts" | "netWorth"

/**
 * Everything the stress test's tabs read and change, owned by StressTestView: one run of the trials and the page's
 * settings and view toggles, so switching tabs never re-runs anything.
 */
export interface StressViewModel extends Pick<PlanEditorProps, "doc" | "update"> {
  projection: PlanProjection
  isHidden: boolean
  annual: AnnualHistory | null
  /** The run's trials, unfiltered. */
  cohorts: CohortResult[] | null
  /** Every trial (after the CAPE filter), and the ones a histogram bar picks (or all of them). */
  all: StressSummary
  summary: StressSummary
  simulated: boolean
  /** "trials" or "periods". */
  unit: string
  age0: number
  retirementIndex: number | null
  /** Setup. */
  sampling: SamplingOptions
  setSampling: (s: SamplingOptions) => void
  align: StressAlign
  setAlign: (a: StressAlign) => void
  canAlignRetirement: boolean
  cape: Cape
  setCape: (c: Cape) => void
  inflation: StressInflation
  setInflation: (i: StressInflation) => void
  /** The histogram bar filter. */
  bin: { slice: HistogramSlice } | null
  setBin: (slice: HistogramSlice | null) => void
  /** Summary. */
  insights: Insight[]
  runOutAge: number | null
  onFix: (fix: InsightFix) => void
  /** Outcomes. */
  yardsticks: OutcomeYardsticks
  endView: EndingView
  setEndView: (v: EndingView) => void
  chartView: ChartView
  setChartView: (v: ChartView) => void
  measure: FanMeasure
  setMeasure: (m: FanMeasure) => void
  bands: number[][]
  /** The steady plan, in the fan chart's measure, and its years-of-spending cushion. */
  plan: number[]
  planCushion: (number | null)[]
  /** The steady plan's net worth by year, today's dollars. */
  planNetWorth: number[]
  /** Improve. */
  target: number
  setTarget: (t: number) => void
  goal: StressGoal
  setGoal: (g: StressGoal) => void
  solvers: SolverRow[]
  impacts: ReturnType<typeof useStressImpacts>
}
