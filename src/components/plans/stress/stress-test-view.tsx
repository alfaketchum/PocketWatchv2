"use client"

import { inflationOf } from "@/lib/plans/plan-inflation"
import { useMemo, useState } from "react"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { deflator } from "@/lib/plans/plan-dollars"
import { ageAtStart } from "@/lib/plans/plan-timing"
import { closeCall, DANGER_YEARS } from "@/lib/plans/stress/stress-close-calls"
import { inSlice, type HistogramSlice } from "@/lib/plans/stress/stress-histogram"
import { DEFAULT_SAMPLING, isSimulated, type SamplingOptions } from "@/lib/plans/stress/stress-sampling"
import type { PlanProjection } from "@/lib/plans/plan-types"
import { anchorIndex, summarize, withdrawalRates, type CohortResult, type StressAlign, type StressInflation } from "@/lib/plans/stress/stress-test"
import type { PlanEditorProps } from "../plans-helpers"
import { sliceLabel, StressHistogramChart } from "./stress-histogram-chart"
import { StressCohortBars } from "./stress-cohort-bars"
import { StressControls, type Cape } from "./stress-controls"
import { StressCushionChart } from "./stress-cushion-chart"
import { StressFanChart, type FanMeasure } from "./stress-fan-chart"
import { StressOutcomeBuckets } from "./stress-outcome-buckets"
import { StressPathsChart } from "./stress-paths-chart"
import { StressEarlySales } from "./stress-early-sales"
import { StressHomeFallbacks } from "./stress-home-fallbacks"
import { StressMixTable } from "./stress-mix-table"
import { StressImpactsTable } from "./stress-impacts-table"
import { IMPACT_TRIALS, useStressImpacts } from "./use-stress-impacts"
import { InflationSource } from "../editor/inflation-source"
import { StressPeriodsTable } from "./stress-periods-table"
import { StressSummary } from "./stress-summary"
import { StressRunAnimation } from "./stress-run-animation"
import { StressTrialsTable } from "./stress-trials-table"
import { useStressTest } from "./use-stress-test"
import { usePlanYardsticks } from "./use-plan-yardsticks"

type ChartView = "range" | "years"

/** Lines drawn in "Sample of trials": enough to see the spread, few enough to stay legible and fast. */
const SAMPLE_LINES = 100

const VIEW_OPTIONS: { value: ChartView; label: string }[] = [
  { value: "range", label: "Range" },
  { value: "years", label: "Each line" },
]
type EndingView = "accounts" | "netWorth"
const ENDING_OPTIONS: { value: EndingView; label: string }[] = [
  { value: "accounts", label: "Money in accounts" },
  { value: "netWorth", label: "Net worth" },
]
const MEASURE_OPTIONS: { value: FanMeasure; label: string }[] = [
  { value: "netWorth", label: "Net worth" },
  { value: "invested", label: "Money in accounts" },
  { value: "withdrawalRate", label: "Withdrawal rate" },
]

const INFO =
  "Your whole plan (income, spending, taxes, loans, purchases) re-run many times, with each account earning what its mix earned in the historical years the trial lives through, after inflation. Simulated trials stitch history's years together in new orders; History replays every complete start year since 1871 (Early Retirement Now's method). Crypto swings twice as hard as stocks around its assumed return."

const IMPACTS_INFO =
  "Your plan run again with one change at a time, through the same markets, to show which levers matter most: moving crypto into stocks and bonds, spending less, skipping a big purchase still ahead, selling a home if the money runs out, or retiring later. Only the changes that fit your plan are tried. They use a smaller set of the simulated markets so they finish in seconds, and your plan as it is runs on that same set, so compare against that row. Nothing in your plan changes."

/** Evenly spaced trials, for drawing a readable sample of many. */
const sampleOf = (cohorts: CohortResult[], n: number) => (cohorts.length <= n ? cohorts : Array.from({ length: n }, (_, i) => cohorts[Math.floor((i * cohorts.length) / n)]))

interface Props extends Pick<PlanEditorProps, "doc" | "update"> {
  projection: PlanProjection
  isHidden: boolean
}

/** The plan through simulated or historical markets: how often it lasts, the spread of outcomes, the worst trials. */
export function StressTestView({ doc, update, projection, isHidden }: Props) {
  const canAlignRetirement = anchorIndex(doc, "retirement") !== null
  const [sampling, setSampling] = useState<SamplingOptions>(DEFAULT_SAMPLING)
  const [alignChoice, setAlign] = useState<StressAlign>("start")
  const align = canAlignRetirement ? alignChoice : "start"
  const [cape, setCape] = useState<Cape>("all")
  const [inflation, setInflation] = useState<StressInflation>("plan")
  const [measureChoice, setMeasure] = useState<FanMeasure>("netWorth")
  const [chartView, setChartView] = useState<ChartView>("range")
  const [endView, setEndView] = useState<EndingView>("accounts")
  const [binChoice, setBin] = useState<{ slice: HistogramSlice; of: CohortResult[] } | null>(null)
  const { annual, anchor, cohorts, method, runId, running, live, loading, error } = useStressTest(doc, align, inflation, sampling)
  // Each run plays its animation once; the results take over when it's done.
  const [finishedRun, setFinishedRun] = useState<number | null>(null)
  const animating = runId !== null && runId !== finishedRun
  const impacts = useStressImpacts({ doc, annual, anchor, inflation, sampling, enabled: !running && cohorts !== null })
  // Labels follow the results on screen, which lag the controls while a new run is in progress.
  const simulated = isSimulated(method)
  const unit = simulated ? "trials" : "periods"
  // Each line can't show withdrawal rates (they're capped and spiky), so it falls back to net worth there.
  const measure = chartView === "years" && measureChoice === "withdrawalRate" ? "netWorth" : measureChoice
  // A histogram filter belongs to the results it was picked from; a new run clears it.
  const bin = binChoice && binChoice.of === cohorts ? binChoice : null
  const capeMin = cape === "all" ? null : Number(cape)
  const all = useMemo(() => (cohorts ? summarize(cohorts, capeMin) : null), [cohorts, capeMin])
  const summary = useMemo(
    () => (cohorts && bin ? summarize(cohorts, capeMin, (c) => inSlice(c, bin.slice)) : all),
    [cohorts, capeMin, bin, all],
  )
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const retirementIndex = anchorIndex(doc, "retirement")
  const plan = useMemo(() => {
    if (measure === "withdrawalRate") return withdrawalRates(doc, projection.rows)
    return projection.rows.map((r) => (measure === "netWorth" ? r.netWorth : r.accountsTotal) / deflator(inflationOf(doc.settings), r.index, "balance"))
  }, [projection, measure, doc])
  const planCushion = useMemo(() => closeCall(projection.rows, age0).cushion, [projection, age0])
  const yardsticks = usePlanYardsticks(doc, projection, endView === "accounts" ? "invested" : "netWorth")
  const bands = summary ? { netWorth: summary.netWorthBands, invested: summary.investedBands, withdrawalRate: summary.withdrawalBands }[measure] : []

  const planNetWorth = useMemo(
    () => projection.rows.map((r) => r.netWorth / deflator(inflationOf(doc.settings), r.index, "balance")),
    [projection, doc.settings],
  )
  return (
    <div className="space-y-5">
      <FireSectionCard eyebrow="Test setup" info={INFO}>
        <div className="mb-5">
          <StressControls
            sampling={sampling}
            onSampling={setSampling}
            align={align}
            onAlign={setAlign}
            canAlignRetirement={canAlignRetirement}
            cape={cape}
            onCape={setCape}
            inflation={inflation}
            onInflation={setInflation}
            latestCape={annual?.latestCape ?? null}
          >
            <StressHomeFallbacks doc={doc} update={update} />
          </StressControls>
        </div>
        {error && <p className="text-sm text-error">Couldn&apos;t load market history.</p>}
        {animating && runId !== null ? (
          <StressRunAnimation
            key={runId}
            trials={live?.trials ?? cohorts ?? []}
            total={live?.total ?? cohorts?.length ?? 0}
            plan={planNetWorth}
            complete={!live}
            onFinished={() => setFinishedRun(runId)}
            unit={isSimulated(sampling.method) ? "simulated markets" : "historical periods"}
          />
        ) : loading || !summary ? (
          <div className="h-24 animate-shimmer rounded-xl" />
        ) : summary.cohorts.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No {unit} match{cape !== "all" ? " this CAPE filter" : ""}
            {simulated ? "." : " with enough history after them for a plan this long."}
            {!simulated && align === "start" && canAlignRetirement && " Try lining history up with retirement, or a simulated method."}
          </p>
        ) : (
          <div key={runId ?? 0} className="animate-scale-in">
            <p className="label-caps mb-2">Result</p>
            {bin && (
              <button type="button" onClick={() => setBin(null)} className="mb-3 inline-flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Only {unit} that {sliceLabel(bin.slice)}
                <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">close</span>
              </button>
            )}
            <StressSummary summary={summary} simulated={simulated} isHidden={isHidden} />
            <StressEarlySales cohorts={summary.cohorts} unit={unit} />
          </div>
        )}
      </FireSectionCard>

      {summary && all && summary.cohorts.length > 0 && (
        <div className={animating || running ? "space-y-5 opacity-50 transition-opacity" : "space-y-5 transition-opacity"}>
          {impacts.available && (
            <FireSectionCard eyebrow="What would help" title="How often the money lasts with one change" info={IMPACTS_INFO}>
              <StressImpactsTable results={impacts.results} total={impacts.total} unit={unit} sampleSize={simulated ? Math.min(IMPACT_TRIALS, sampling.trials) : summary.cohorts.length} />
            </FireSectionCard>
          )}
          <FireSectionCard
            eyebrow="How it ended"
            title={endView === "accounts" ? "Left in accounts, today's dollars" : "Net worth at the end, today's dollars"}
            info={
              endView === "accounts"
                ? `How many ${unit} ran out of money, and how many of the rest ended with each amount in your accounts, colored by outcome. Money in accounts is what pays the bills, and what the outcomes below are measured on. Click a bar to show only those ${unit} everywhere on this page; click it again to clear.`
                : `How many ${unit} ran out of money, and how many of the rest ended with each net worth, each bar split by how much of it is money in your accounts versus home and other property (net of debts). A run can end with a valuable home and nothing left to spend. Click a bar to show only those ${unit} everywhere on this page; click it again to clear.`
            }
            right={<ChoiceChips label="Ending" options={ENDING_OPTIONS} value={endView} onChange={setEndView} />}
          >
            <StressHistogramChart
              cohorts={all.cohorts}
              yardsticks={yardsticks}
              measure={endView === "accounts" ? "invested" : "netWorth"}
              selected={bin?.slice ?? null}
              onSelect={(slice) => setBin(slice && cohorts ? { slice, of: cohorts } : null)}
              isHidden={isHidden}
            />
            <StressOutcomeBuckets cohorts={summary.cohorts} yardsticks={yardsticks} isHidden={isHidden} />
          </FireSectionCard>
          <FireSectionCard
            eyebrow={chartView === "range" ? "Range of outcomes" : simulated ? "Sample of trials" : "Every historical start year"}
            title={measure === "withdrawalRate" ? "Withdrawal rate by age" : "Today's dollars by age"}
            info={
              chartView === "range"
                ? `Shaded: the middle 80% and middle 50% of ${unit}. Solid: the median. Dashed: your plan with its steady assumed returns. Red: the worst ${simulated ? "trial" : "start year"}. Withdrawal rate: each year's withdrawals over what your accounts held at its start, capped at 100% (a year they couldn't cover counts as 100%).`
                : simulated
                  ? `${SAMPLE_LINES} of the trials, evenly picked. Red lines ran out of money. Dashed: your plan with steady returns.`
                  : "Each line is your plan starting in one historical year. Red lines ran out of money; crisis years (1929, 1937, 1966, 1973, 2000, 2007) are highlighted. Dashed: your plan with steady returns."
            }
            right={
              <div className="flex flex-wrap items-center gap-3">
                <ChoiceChips label="Chart" options={VIEW_OPTIONS} value={chartView} onChange={setChartView} />
                <ChoiceChips label="Measure" options={chartView === "years" ? MEASURE_OPTIONS.slice(0, 2) : MEASURE_OPTIONS} value={measure} onChange={setMeasure} />
              </div>
            }
          >
            {chartView === "range" ? (
              <StressFanChart bands={bands} age0={age0} plan={plan} worst={summary.worst} measure={measure} isHidden={isHidden} />
            ) : (
              <StressPathsChart
                cohorts={sampleOf(summary.cohorts, SAMPLE_LINES)}
                age0={age0}
                plan={plan}
                measure={measure === "invested" ? "invested" : "netWorth"}
                isHidden={isHidden}
              />
            )}
          </FireSectionCard>
          <FireSectionCard eyebrow={simulated ? "Every trial" : "Every start year"} title="Worst first" info="The historical years each one lived through (runs of consecutive years), net worth at retirement, what was left in your accounts and your net worth at the end (today's dollars), and how it ended.">
            <StressTrialsTable key={`${sampling.method}-${sampling.seed}`} cohorts={summary.cohorts} yardsticks={yardsticks} retirementIndex={retirementIndex} isHidden={isHidden} />
          </FireSectionCard>
          <FireSectionCard
            eyebrow="Close calls"
            title="Years of spending left, by age"
            info={`How long the money in your accounts would pay that year's bills and debt payments, counted only once you're living off them (blank while income pays the bills). Shaded red: under ${DANGER_YEARS} years, the danger zone; the area a line spends in it is the danger-years. Bands: the middle 80% and 50% of ${unit}. Solid: the median. Dashed: your plan with steady returns. Red line: the worst one. Drawn up to 25 years.`}
          >
            <StressCushionChart cohorts={summary.cohorts} age0={age0} plan={planCushion} worst={summary.worst} isHidden={isHidden} />
          </FireSectionCard>
          {!simulated && (
            <div className="grid gap-5 xl:grid-cols-2">
              <FireSectionCard eyebrow="By start year" title="Ending net worth" info="One bar per historical start year; red where the money ran out before the plan's end.">
                <StressCohortBars cohorts={summary.cohorts} isHidden={isHidden} />
              </FireSectionCard>
              <FireSectionCard eyebrow="Worst periods" title="Starting in a crisis">
                <StressPeriodsTable cohorts={cohorts ?? []} isHidden={isHidden} />
              </FireSectionCard>
            </div>
          )}
        </div>
      )}

      <FireSectionCard eyebrow="Assumptions" title="Inflation and account mix" info="Inflation is the plan's own (shared with Assumptions). The mix is used only for the stress test. Stocks and bonds earn their historical returns after inflation, cash earns nothing after inflation, and crypto swings twice as hard as stocks around its own assumed return.">
        <div className="mb-4">
          <InflationSource doc={doc} update={update} compact />
        </div>
        <StressMixTable doc={doc} update={update} />
      </FireSectionCard>
    </div>
  )
}
