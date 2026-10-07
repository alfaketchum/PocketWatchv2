"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { deflator } from "@/lib/plans/plan-dollars"
import { inflationOf } from "@/lib/plans/plan-inflation"
import type { PlanProjection } from "@/lib/plans/plan-types"
import { ageAtStart } from "@/lib/plans/plan-timing"
import { closeCall } from "@/lib/plans/stress/stress-close-calls"
import { diagnose, type InsightFix } from "@/lib/plans/stress/stress-diagnosis"
import { inSlice, type HistogramSlice } from "@/lib/plans/stress/stress-histogram"
import { DEFAULT_SAMPLING, isSimulated, type SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import type { StressGoal } from "@/lib/plans/stress/stress-solvers"
import { anchorIndex, summarize, withdrawalRates, type CohortResult, type StressAlign, type StressInflation } from "@/lib/plans/stress/stress-test"
import type { PlanEditorProps } from "../plans-helpers"
import type { Cape } from "./stress-controls"
import { fixAnchor } from "./stress-diagnosis-card"
import type { FanMeasure } from "./stress-fan-chart"
import { sliceLabel } from "./stress-histogram-chart"
import { StressChartHeader } from "./stress-result-chart"
import { settingsLine, StressResultBar } from "./stress-result-bar"
import { StressRunAnimation } from "./stress-run-animation"
import { StressHeadline } from "./stress-summary"
import { StressTabImprove } from "./stress-tab-improve"
import { stressTabFrom, DEFAULT_STRESS_TAB, type StressTab } from "./stress-tab-names"
import { StressTabOutcomes } from "./stress-tab-outcomes"
import { StressTabSetup, type StressSetupModel } from "./stress-tab-setup"
import { StressTabSummary } from "./stress-tab-summary"
import { StressTabTrials } from "./stress-tab-trials"
import { StressTabs } from "./stress-tabs"
import type { ChartView, EndingView, StressViewModel } from "./stress-view-model"
import { usePlanYardsticks } from "./use-plan-yardsticks"
import { useStressImpacts } from "./use-stress-impacts"
import { useStressSolvers } from "./use-stress-solvers"
import { useStressTest } from "./use-stress-test"

/** The success rate the diagnosis and solvers aim for, until changed on the page. */
const DEFAULT_TARGET = 0.9
/** The trials chart above every tab: tall enough to read the spread, short enough to leave room for the tab. */
const RESULT_CHART_HEIGHT = 180
/** A beat for the Improve tab to render before scrolling to a fix's row. */
const SCROLL_DELAY_MS = 60

interface Props extends Pick<PlanEditorProps, "doc" | "update"> {
  projection: PlanProjection
  isHidden: boolean
}

/** The tab in the URL (?tab=), kept in state; switching replaces the URL without navigating. */
function useStressTab(): [StressTab, (tab: StressTab) => void] {
  const pathname = usePathname()
  const params = useSearchParams()
  const [tab, setTabState] = useState<StressTab>(() => stressTabFrom(params.get("tab")))
  const setTab = useCallback(
    (next: StressTab) => {
      setTabState(next)
      window.history.replaceState(window.history.state, "", next === DEFAULT_STRESS_TAB ? pathname : `${pathname}?tab=${next}`)
    },
    [pathname],
  )
  return [tab, setTab]
}

/**
 * The plan through simulated or historical markets. One run feeds every tab: the result above them, then Setup (where
 * it opens), Summary, Improve, Outcomes and Trials. What would help and the solvers start once Improve is first opened.
 */
export function StressTestView({ doc, update, projection, isHidden }: Props) {
  const [tab, setTab] = useStressTab()
  const [improveOpened, setImproveOpened] = useState(tab === "improve")
  useEffect(() => {
    if (tab === "improve") setImproveOpened(true)
  }, [tab])
  const canAlignRetirement = anchorIndex(doc, "retirement") !== null
  const [sampling, setSampling] = useState<SamplingOptions>(DEFAULT_SAMPLING)
  const [alignChoice, setAlign] = useState<StressAlign>("start")
  const align = canAlignRetirement ? alignChoice : "start"
  const [cape, setCape] = useState<Cape>("all")
  const [inflation, setInflation] = useState<StressInflation>("plan")
  const [measureChoice, setMeasure] = useState<FanMeasure>("netWorth")
  const [chartView, setChartView] = useState<ChartView>("range")
  const [endView, setEndView] = useState<EndingView>("netWorth")
  const [binChoice, setBin] = useState<{ slice: HistogramSlice; of: CohortResult[] } | null>(null)
  const { annual, anchor, cohorts, method, runId, running, live, loading, error } = useStressTest(doc, align, inflation, sampling)
  // Each run plays its animation once; the results take over when it's done.
  const [finishedRun, setFinishedRun] = useState<number | null>(null)
  const animating = runId !== null && runId !== finishedRun
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [goal, setGoal] = useState<StressGoal>("cash")
  const background = improveOpened && !running && cohorts !== null
  const solvers = useStressSolvers({ doc, annual, anchor, inflation, sampling, target, goal, enabled: background })
  const impacts = useStressImpacts({ doc, annual, anchor, inflation, sampling, enabled: background })
  // Labels follow the results on screen, which lag the controls while a new run is in progress.
  const simulated = isSimulated(method)
  const unit = simulated ? "trials" : "periods"
  // Each line can't show withdrawal rates (they're capped and spiky), so it falls back to net worth there.
  const measure = chartView === "years" && measureChoice === "withdrawalRate" ? "netWorth" : measureChoice
  // A histogram filter belongs to the results it was picked from; a new run clears it.
  const bin = binChoice && binChoice.of === cohorts ? binChoice : null
  const capeMin = cape === "all" ? null : Number(cape)
  const all = useMemo(() => (cohorts ? summarize(cohorts, capeMin) : null), [cohorts, capeMin])
  const summary = useMemo(() => (cohorts && bin ? summarize(cohorts, capeMin, (c) => inSlice(c, bin.slice)) : all), [cohorts, capeMin, bin, all])
  const runOutAge = useMemo(() => {
    const ages = (all?.cohorts ?? []).flatMap((c) => (c.depletedAge !== null ? [c.depletedAge] : [])).sort((a, b) => a - b)
    return ages.length > 0 ? ages[Math.floor((ages.length - 1) / 2)] : null
  }, [all])
  const insights = useMemo(() => (all ? diagnose(doc, projection, all.cohorts, annual) : []), [all, doc, projection, annual])
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const plan = useMemo(() => {
    if (measure === "withdrawalRate") return withdrawalRates(doc, projection.rows)
    return projection.rows.map((r) => (measure === "netWorth" ? r.netWorth : r.accountsTotal) / deflator(inflationOf(doc.settings), r.index, "balance"))
  }, [projection, measure, doc])
  const planNetWorth = useMemo(() => projection.rows.map((r) => r.netWorth / deflator(inflationOf(doc.settings), r.index, "balance")), [projection, doc.settings])
  const planCushion = useMemo(() => closeCall(projection.rows, age0).cushion, [projection, age0])
  const yardsticks = usePlanYardsticks(doc, projection, endView === "accounts" ? "invested" : "netWorth")
  // A fix lives on Improve: open it, then scroll to its row once it has rendered.
  const onFix = useCallback(
    (fix: InsightFix) => {
      setTab("improve")
      setTimeout(() => document.getElementById(fixAnchor(fix))?.scrollIntoView({ behavior: "smooth", block: "center" }), SCROLL_DELAY_MS)
    },
    [setTab],
  )

  const ready = summary && all && summary.cohorts.length > 0
  // The run's chart stays once it has played: every trial's line, the satisfying part, with the numbers under it.
  const chart =
    runId !== null ? (
      <StressRunAnimation
        key={`chart-${runId}`}
        trials={live?.trials ?? cohorts ?? []}
        total={live?.total ?? cohorts?.length ?? 0}
        plan={planNetWorth}
        complete={!live}
        onFinished={() => setFinishedRun(runId)}
        unit={isSimulated(sampling.method) ? "simulated markets" : "historical periods"}
        height={RESULT_CHART_HEIGHT}
        done={!animating}
      />
    ) : null
  const numbers = animating ? null : loading || !summary ? (
    <div className="h-16 animate-shimmer rounded-xl" />
  ) : !ready ? (
    <p className="text-sm text-foreground-muted">
      No {unit} match{cape !== "all" ? " this CAPE filter" : ""}
      {simulated ? "." : " with enough history after them for a plan this long."}
      {!simulated && align === "start" && canAlignRetirement && " Try lining history up with retirement, or a simulated method."}
    </p>
  ) : (
    <div key={`numbers-${runId ?? 0}`} className="animate-scale-in">
      <StressHeadline summary={summary} simulated={simulated} />
    </div>
  )
  const headline = (
    <>
      {chart}
      {numbers}
    </>
  )

  const setup: StressSetupModel = { doc, update, annual, sampling, setSampling, align, setAlign, canAlignRetirement, cape, setCape, inflation, setInflation }
  const v: StressViewModel | null = ready
    ? {
        ...setup,
        projection, isHidden, cohorts, all, summary, simulated, unit, age0,
        retirementIndex: anchorIndex(doc, "retirement"),
        bin, setBin: (slice) => setBin(slice && cohorts ? { slice, of: cohorts } : null),
        insights, runOutAge, onFix, yardsticks, endView, setEndView, chartView, setChartView, measure, setMeasure,
        bands: { netWorth: summary.netWorthBands, invested: summary.investedBands, withdrawalRate: summary.withdrawalBands }[measure],
        plan, planCushion, planNetWorth, target, setTarget, goal, setGoal, solvers, impacts,
      }
    : null

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-error">Couldn&apos;t load market history.</p>}
      <StressResultBar
        header={<StressChartHeader sampling={sampling} onSampling={setSampling} size={ready ? `${summary.cohorts.length.toLocaleString()} ${simulated ? "trials" : "start years"}` : null} />}
        settings={settingsLine(sampling, cape, inflation)}
        onChangeSettings={() => setTab("setup")}
        filter={bin ? `Only ${unit} that ${sliceLabel(bin.slice)}` : null}
        onClearFilter={() => setBin(null)}
      >
        {headline}
      </StressResultBar>
      <StressTabs value={tab} onChange={setTab} />
      <div className={animating || running ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {tab === "setup" ? (
          <StressTabSetup v={setup} />
        ) : v === null ? null : tab === "summary" ? (
          <StressTabSummary v={v} />
        ) : tab === "improve" ? (
          <StressTabImprove v={v} />
        ) : tab === "outcomes" ? (
          <StressTabOutcomes v={v} />
        ) : (
          <StressTabTrials v={v} />
        )}
      </div>
    </div>
  )
}
