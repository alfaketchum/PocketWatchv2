"use client"

import { inflationOf } from "@/lib/plans/plan-inflation"
import { useMemo, useState } from "react"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { deflator } from "@/lib/plans/plan-dollars"
import { ageAtStart } from "@/lib/plans/plan-timing"
import type { PlanProjection } from "@/lib/plans/plan-types"
import { anchorIndex, summarize, type StressAlign, type StressInflation } from "@/lib/plans/stress/stress-test"
import type { PlanEditorProps } from "../plans-helpers"
import { StressCohortBars } from "./stress-cohort-bars"
import { StressFanChart } from "./stress-fan-chart"
import { StressOutcomeBuckets } from "./stress-outcome-buckets"
import { StressPathsChart } from "./stress-paths-chart"
import { StressMixTable } from "./stress-mix-table"
import { InflationSource } from "../editor/inflation-source"
import { StressPeriodsTable } from "./stress-periods-table"
import { StressSummary } from "./stress-summary"
import { useStressTest } from "./use-stress-test"

type Cape = "all" | "20" | "30"
type Measure = "netWorth" | "invested"
type ChartView = "range" | "years"

const ALIGN_OPTIONS: { value: StressAlign; label: string }[] = [
  { value: "start", label: "From today" },
  { value: "retirement", label: "From retirement" },
]
const INFLATION_OPTIONS: { value: StressInflation; label: string }[] = [
  { value: "plan", label: "Plan's assumption" },
  { value: "history", label: "What actually happened" },
]
const INFLATION_INFO =
  "The historical returns already have each year's real inflation taken out, so for anything that rises with prices the inflation rate cancels. \"What actually happened\" also runs each period through its real inflation (official CPI, from 1913): pensions without raises lose buying power faster in the 1970s, fixed loan payments get cheaper, and tax lines fixed in dollars catch more income. Earlier years keep the plan's rate."
const VIEW_OPTIONS: { value: ChartView; label: string }[] = [
  { value: "range", label: "Range" },
  { value: "years", label: "Each start year" },
]
const MEASURE_OPTIONS: { value: Measure; label: string }[] = [
  { value: "netWorth", label: "Net worth" },
  { value: "invested", label: "Money in accounts" },
]

const INFO =
  "Early Retirement Now's method: your whole plan (income, spending, taxes, loans, purchases) re-run once for every starting year since 1871, with each account earning what its mix earned in the years that followed, after inflation. Only start years with history all the way to the plan's end count. Crypto swings twice as hard as stocks around its assumed return."

interface Props extends Pick<PlanEditorProps, "doc" | "update"> {
  projection: PlanProjection
  isHidden: boolean
}

/** The plan replayed through every historical market: how often it lasts, the spread of outcomes, the worst years. */
export function StressTestView({ doc, update, projection, isHidden }: Props) {
  const canAlignRetirement = anchorIndex(doc, "retirement") !== null
  const [alignChoice, setAlign] = useState<StressAlign>("start")
  const align = canAlignRetirement ? alignChoice : "start"
  const [cape, setCape] = useState<Cape>("all")
  const [inflation, setInflation] = useState<StressInflation>("plan")
  const [measure, setMeasure] = useState<Measure>("netWorth")
  const [chartView, setChartView] = useState<ChartView>("range")
  const { annual, cohorts, running, loading, error } = useStressTest(doc, align, inflation)
  const summary = useMemo(() => (cohorts ? summarize(cohorts, cape === "all" ? null : Number(cape)) : null), [cohorts, cape])
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const plan = useMemo(
    () => projection.rows.map((r) => (measure === "netWorth" ? r.netWorth : r.accountsTotal) / deflator(inflationOf(doc.settings), r.index, "balance")),
    [projection, measure, doc.settings],
  )
  // The outcome buckets' yardsticks, from this plan: the money in your accounts today and a year of spending at the
  // end. Always account money, whatever the chart shows: running out is about what can pay the bills.
  const yardsticks = useMemo(() => {
    const inflation = inflationOf(doc.settings)
    const spending = projection.rows
      .map((r) => r.expenses / deflator(inflation, r.index, "flow"))
      .filter((v) => v > 0)
    const invested = doc.accounts.reduce((s, a) => s + a.balance, 0)
    return {
      startValue: invested,
      yearlySpending: spending.at(-1) ?? 0,
      endAge: doc.settings.endAge,
      measure: "invested" as const,
    }
  }, [projection, doc.settings, doc.accounts])
  const capeOptions: { value: Cape; label: string }[] = [
    { value: "all", label: "All years" },
    { value: "20", label: "CAPE ≥ 20" },
    { value: "30", label: "CAPE ≥ 30" },
  ]

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      {canAlignRetirement && <ChoiceChips label="Line history up with" options={ALIGN_OPTIONS} value={align} onChange={setAlign} />}
      <ChoiceChips label="Expensive markets only" options={capeOptions} value={cape} onChange={setCape} />
      <div className="flex items-center gap-1">
        <ChoiceChips label="Inflation" options={INFLATION_OPTIONS} value={inflation} onChange={setInflation} />
        <InfoTooltip content={INFLATION_INFO} />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <FireSectionCard eyebrow="Stress test" title="Your plan through every market since 1871" info={INFO} right={controls}>
        {error && <p className="text-sm text-error">Couldn&apos;t load market history.</p>}
        {loading || !summary ? (
          <div className="h-24 animate-shimmer rounded-xl" />
        ) : summary.cohorts.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No start years match{cape !== "all" ? " this CAPE filter" : ""} with enough history after them for a plan this long.
            {align === "start" && canAlignRetirement && " Try lining history up with retirement."}
          </p>
        ) : (
          <div className={running ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <StressSummary summary={summary} isHidden={isHidden} />
            <p className="mt-3 text-[11px] text-foreground-muted">
              Today&apos;s CAPE is {annual?.latestCape.toFixed(1)}: stock prices are high against earnings, which historically came before weaker returns.
              {cape === "all" ? " Filter to expensive start years to see those periods only." : ""}
            </p>
          </div>
        )}
      </FireSectionCard>

      {summary && summary.cohorts.length > 0 && (
        <>
          <FireSectionCard
            eyebrow={chartView === "range" ? "Range of outcomes" : "Every historical start year"}
            title="Today's dollars, by age"
            info={
              chartView === "range"
                ? "Shaded: the middle 80% and middle 50% of historical periods. Solid: the median. Dashed: your plan with its steady assumed returns. Red: the worst start year."
                : "Each line is your plan starting in one historical year. Red lines ran out of money; crisis years (1929, 1937, 1966, 1973, 2000, 2007) are highlighted. Dashed: your plan with steady returns."
            }
            right={
              <div className="flex flex-wrap items-center gap-3">
                <ChoiceChips label="Chart" options={VIEW_OPTIONS} value={chartView} onChange={setChartView} />
                <ChoiceChips label="Measure" options={MEASURE_OPTIONS} value={measure} onChange={setMeasure} />
              </div>
            }
          >
            {chartView === "range" ? (
              <>
                <StressFanChart
                  bands={measure === "netWorth" ? summary.netWorthBands : summary.investedBands}
                  age0={age0}
                  plan={plan}
                  worst={summary.worst}
                  measure={measure}
                  isHidden={isHidden}
                />
                <StressOutcomeBuckets cohorts={summary.cohorts} yardsticks={yardsticks} isHidden={isHidden} />
              </>
            ) : (
              <StressPathsChart cohorts={summary.cohorts} age0={age0} plan={plan} measure={measure} isHidden={isHidden} />
            )}
          </FireSectionCard>
          <div className="grid gap-5 xl:grid-cols-2">
            <FireSectionCard eyebrow="By start year" title="Ending net worth" info="One bar per historical start year; red where the money ran out before the plan's end.">
              <StressCohortBars cohorts={summary.cohorts} isHidden={isHidden} />
            </FireSectionCard>
            <FireSectionCard eyebrow="Worst periods" title="Starting in a crisis">
              <StressPeriodsTable cohorts={cohorts ?? []} isHidden={isHidden} />
            </FireSectionCard>
          </div>
        </>
      )}

      <FireSectionCard eyebrow="Assumptions" title="Inflation and what each account holds" info="Inflation is the plan's own (shared with Assumptions). The mix is used only for the stress test. Stocks and bonds earn their historical returns after inflation, cash earns nothing after inflation, and crypto swings twice as hard as stocks around its own assumed return.">
        <div className="mb-4">
          <InflationSource doc={doc} update={update} compact />
        </div>
        <StressMixTable doc={doc} update={update} />
      </FireSectionCard>
    </div>
  )
}
