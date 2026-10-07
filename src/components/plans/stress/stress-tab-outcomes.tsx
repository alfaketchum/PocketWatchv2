"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { DANGER_YEARS } from "@/lib/plans/stress/stress-close-calls"
import type { CohortResult } from "@/lib/plans/stress/stress-test"
import { StressCushionChart } from "./stress-cushion-chart"
import { StressFanChart, type FanMeasure } from "./stress-fan-chart"
import { StressHistogramChart } from "./stress-histogram-chart"
import { StressOutcomeBuckets } from "./stress-outcome-buckets"
import { StressPathsChart } from "./stress-paths-chart"
import type { ChartView, EndingView, StressViewModel } from "./stress-view-model"

/** Lines drawn in "Sample of trials": enough to see the spread, few enough to stay legible and fast. */
const SAMPLE_LINES = 100

const VIEW_OPTIONS: { value: ChartView; label: string }[] = [
  { value: "range", label: "Range" },
  { value: "years", label: "Each line" },
]
const ENDING_OPTIONS: { value: EndingView; label: string }[] = [
  { value: "netWorth", label: "Net worth" },
  { value: "accounts", label: "Money in accounts" },
]
const MEASURE_OPTIONS: { value: FanMeasure; label: string }[] = [
  { value: "netWorth", label: "Net worth" },
  { value: "invested", label: "Money in accounts" },
  { value: "withdrawalRate", label: "Withdrawal rate" },
]

/** Evenly spaced trials, for drawing a readable sample of many. */
const sampleOf = (cohorts: CohortResult[], n: number) => (cohorts.length <= n ? cohorts : Array.from({ length: n }, (_, i) => cohorts[Math.floor((i * cohorts.length) / n)]))

function HowItEnded({ v }: { v: StressViewModel }) {
  const accounts = v.endView === "accounts"
  return (
    <FireSectionCard
      eyebrow="How it ended"
      title={accounts ? "Left in accounts, today's dollars" : "Net worth at the end, today's dollars"}
      info={
        accounts
          ? `How many ${v.unit} ran out of cash, and how many of the rest ended with each amount in your accounts, colored by outcome. Money in accounts is what pays the bills. Click a bar to show only those ${v.unit} on every tab; click it again to clear.`
          : `How many ${v.unit} ran out of cash, and how many of the rest ended with each net worth, each bar split by how much of it is money in your accounts versus home and other property (net of debts). Click a bar to show only those ${v.unit} on every tab; click it again to clear.`
      }
      right={<ChoiceChips label="Ending" options={ENDING_OPTIONS} value={v.endView} onChange={v.setEndView} />}
    >
      <StressHistogramChart
        cohorts={v.all.cohorts}
        yardsticks={v.yardsticks}
        measure={accounts ? "invested" : "netWorth"}
        selected={v.bin?.slice ?? null}
        onSelect={v.setBin}
        isHidden={v.isHidden}
      />
      <StressOutcomeBuckets cohorts={v.summary.cohorts} yardsticks={v.yardsticks} isHidden={v.isHidden} />
    </FireSectionCard>
  )
}

function ByAge({ v }: { v: StressViewModel }) {
  const range = v.chartView === "range"
  return (
    <FireSectionCard
      eyebrow={range ? "Range of outcomes" : v.simulated ? "Sample of trials" : "Every historical start year"}
      title={v.measure === "withdrawalRate" ? "Withdrawal rate by age" : "Today's dollars by age"}
      info={
        range
          ? `Shaded: the middle 80% and middle 50% of ${v.unit}. Solid: the median. Dashed: your plan with its steady assumed returns. Red: the worst ${v.simulated ? "trial" : "start year"}. Withdrawal rate: each year's withdrawals over what your accounts held at its start, capped at 100% (a year they couldn't cover counts as 100%).`
          : v.simulated
            ? `${SAMPLE_LINES} of the trials, evenly picked. Amber lines ran out of cash, red ones went broke. Dashed: your plan with steady returns.`
            : "Each line is your plan starting in one historical year. Amber lines ran out of cash, red ones went broke; crisis years (1929, 1937, 1966, 1973, 2000, 2007) are highlighted. Dashed: your plan with steady returns."
      }
      right={
        <div className="flex flex-wrap items-center gap-3">
          <ChoiceChips label="Chart" options={VIEW_OPTIONS} value={v.chartView} onChange={v.setChartView} />
          <ChoiceChips label="Measure" options={v.chartView === "years" ? MEASURE_OPTIONS.slice(0, 2) : MEASURE_OPTIONS} value={v.measure} onChange={v.setMeasure} />
        </div>
      }
    >
      {range ? (
        <StressFanChart bands={v.bands} age0={v.age0} plan={v.plan} worst={v.summary.worst} measure={v.measure} isHidden={v.isHidden} />
      ) : (
        <StressPathsChart cohorts={sampleOf(v.summary.cohorts, SAMPLE_LINES)} age0={v.age0} plan={v.plan} measure={v.measure === "invested" ? "invested" : "netWorth"} isHidden={v.isHidden} />
      )}
    </FireSectionCard>
  )
}

/** Outcomes: how the trials ended, the spread by age, and how close they came to running out. */
export function StressTabOutcomes({ v }: { v: StressViewModel }) {
  return (
    <div className="space-y-5">
      <HowItEnded v={v} />
      <ByAge v={v} />
      <FireSectionCard
        eyebrow="Close calls"
        title="Years of spending left, by age"
        info={`How long the money in your accounts would pay that year's bills and debt payments, counted only once you're living off them (blank while income pays the bills). Shaded red: under ${DANGER_YEARS} years, the danger zone; the area a line spends in it is the danger-years. Bands: the middle 80% and 50% of ${v.unit}. Solid: the median. Dashed: your plan with steady returns. Red line: the worst one. Drawn up to 25 years.`}
      >
        <StressCushionChart cohorts={v.summary.cohorts} age0={v.age0} plan={v.planCushion} worst={v.summary.worst} isHidden={v.isHidden} />
      </FireSectionCard>
    </div>
  )
}
