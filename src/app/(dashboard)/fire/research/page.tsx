"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { useFirePlan } from "@/hooks/finance/use-fire-plan"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { summarizeCohorts } from "@/lib/fire/swr-simulation"
import { SwrHeatmap } from "@/components/fire/swr-heatmap"
import { CapeRuleCard } from "@/components/fire/cape-rule-card"
import { GlidepathCompare } from "@/components/fire/glidepath-compare"
import { SupplementalFlowsCard } from "@/components/fire/supplemental-flows-card"
import { CohortPathsChart } from "@/components/fire/cohort-paths-chart"
import { fmtMonth, fmtPct } from "@/components/fire/fire-helpers"
import { FireAdvancedGate } from "@/components/fire/fire-advanced-gate"

const chartSkeleton = () => <div className="h-[360px] animate-shimmer rounded-2xl" />

const MaxWrByYearChart = dynamic(
  () => import("@/components/fire/max-wr-by-year-chart").then((m) => m.MaxWrByYearChart),
  { ssr: false, loading: chartSkeleton },
)
const WithdrawalStrategiesCard = dynamic(
  () => import("@/components/fire/withdrawal-strategies-card").then((m) => m.WithdrawalStrategiesCard),
  { ssr: false, loading: chartSkeleton },
)
const SequenceRiskChart = dynamic(
  () => import("@/components/fire/sequence-risk-chart").then((m) => m.SequenceRiskChart),
  { ssr: false, loading: chartSkeleton },
)

export default function FireResearchPage() {
  const state = useFirePlan()
  const { isHidden } = usePrivacyMode()
  const { history, simOptions, plan, inputs, analysis } = state

  const summaries = useMemo(() => (history ? summarizeCohorts(history, simOptions) : []), [history, simOptions])

  if (inputs.mode !== "advanced") {
    return <FireAdvancedGate title="The Safe Withdrawal Lab is part of Advanced mode" onSwitch={() => state.update({ mode: "advanced" })} />
  }

  if (!history) {
    return <div className="space-y-6">{[0, 1, 2].map((i) => <div key={i} className="h-[320px] animate-shimmer rounded-2xl" />)}</div>
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-foreground-muted">
        Testing your plan — {fmtPct(plan.swr, 2)} withdrawals, {inputs.horizonYears} years,{" "}
        {inputs.glidepath.enabled
          ? `${Math.round(inputs.glidepath.startEquity * 100)}→${Math.round(inputs.glidepath.endEquity * 100)}% stocks`
          : `${Math.round(inputs.equityShare * 100)}% stocks`}
        , {Math.round(inputs.finalValueTarget * 100)}% final value — against every month from 1871 to{" "}
        {fmtMonth(history.dataThrough)}. Methodology after Big ERN&apos;s{" "}
        <a href="https://earlyretirementnow.com/safe-withdrawal-rate-series/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          Safe Withdrawal Rate Series
        </a>
        ; data from Robert Shiller.
      </p>
      <SwrHeatmap history={history} probeWr={plan.swr} />
      <CohortPathsChart history={history} wr={plan.swr} opts={simOptions} portfolio={analysis.fireNumber} isHidden={isHidden} />
      <MaxWrByYearChart summaries={summaries} wr={plan.swr} horizonYears={inputs.horizonYears} />
      <WithdrawalStrategiesCard state={state} isHidden={isHidden} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CapeRuleCard state={state} isHidden={isHidden} />
        <SupplementalFlowsCard
          history={history}
          opts={simOptions}
          flows={inputs.flows}
          annualSpend={plan.annualSpend}
          retireAge={analysis.retireAge}
        />
      </div>
      <SequenceRiskChart summaries={summaries} wr={plan.swr} />
      <GlidepathCompare history={history} opts={simOptions} wr={plan.swr} />
    </div>
  )
}
