"use client"

import { useMemo, useState } from "react"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { deflator } from "@/lib/plans/plan-dollars"
import { ageAtStart } from "@/lib/plans/plan-timing"
import type { PlanProjection } from "@/lib/plans/plan-types"
import { anchorIndex, summarize, type StressAlign } from "@/lib/plans/stress/stress-test"
import type { PlanEditorProps } from "../plans-helpers"
import { StressCohortBars } from "./stress-cohort-bars"
import { StressFanChart } from "./stress-fan-chart"
import { StressMixTable } from "./stress-mix-table"
import { StressPeriodsTable } from "./stress-periods-table"
import { StressSummary } from "./stress-summary"
import { useStressTest } from "./use-stress-test"

type Cape = "all" | "20" | "30"
type Measure = "netWorth" | "invested"

const ALIGN_OPTIONS: { value: StressAlign; label: string }[] = [
  { value: "start", label: "From today" },
  { value: "retirement", label: "From retirement" },
]
const MEASURE_OPTIONS: { value: Measure; label: string }[] = [
  { value: "netWorth", label: "Net worth" },
  { value: "invested", label: "Invested" },
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
  const [measure, setMeasure] = useState<Measure>("netWorth")
  const { annual, cohorts, running, loading, error } = useStressTest(doc, align)
  const summary = useMemo(() => (cohorts ? summarize(cohorts, cape === "all" ? null : Number(cape)) : null), [cohorts, cape])
  const person = doc.people[0]
  const age0 = person ? ageAtStart(person, doc.settings) : 0
  const plan = useMemo(
    () => projection.rows.map((r) => (measure === "netWorth" ? r.netWorth : r.accountsTotal) / deflator(doc.settings.inflation, r.index, "balance")),
    [projection, measure, doc.settings.inflation],
  )
  const capeOptions: { value: Cape; label: string }[] = [
    { value: "all", label: "All years" },
    { value: "20", label: "CAPE ≥ 20" },
    { value: "30", label: "CAPE ≥ 30" },
  ]

  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      {canAlignRetirement && <ChoiceChips label="Line history up with" options={ALIGN_OPTIONS} value={align} onChange={setAlign} />}
      <ChoiceChips label="Expensive markets only" options={capeOptions} value={cape} onChange={setCape} />
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
            eyebrow="Range of outcomes"
            title="Today's dollars, by age"
            info="Shaded: the middle 80% and middle 50% of historical periods. Solid: the median. Dashed: your plan with its steady assumed returns. Red: the worst start year."
            right={<ChoiceChips label="Measure" options={MEASURE_OPTIONS} value={measure} onChange={setMeasure} />}
          >
            <StressFanChart
              bands={measure === "netWorth" ? summary.netWorthBands : summary.investedBands}
              age0={age0}
              plan={plan}
              worst={summary.worst}
              measure={measure}
              isHidden={isHidden}
            />
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

      <FireSectionCard eyebrow="Assumptions" title="What each account holds" info="Used only for the stress test. Stocks and bonds earn their historical returns after inflation, cash earns nothing after inflation, and crypto swings twice as hard as stocks around its own assumed return.">
        <StressMixTable doc={doc} update={update} />
      </FireSectionCard>
    </div>
  )
}
