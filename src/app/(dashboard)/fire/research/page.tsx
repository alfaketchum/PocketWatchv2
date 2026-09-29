"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
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
const RichBrokeDeadCard = dynamic(
  () => import("@/components/fire/rich-broke-dead-card").then((m) => m.RichBrokeDeadCard),
  { ssr: false, loading: chartSkeleton },
)
const SequenceRiskChart = dynamic(
  () => import("@/components/fire/sequence-risk-chart").then((m) => m.SequenceRiskChart),
  { ssr: false, loading: chartSkeleton },
)

type LabTab = "rates" | "stress" | "spending"

const LAB_TABS: { key: LabTab; label: string; icon: string; question: string }[] = [
  { key: "rates", label: "Withdrawal rates", icon: "percent", question: "How much can you safely withdraw — and how do valuations and your stock mix change that?" },
  { key: "stress", label: "Stress tests", icon: "thunderstorm", question: "What happens to your plan in the worst markets in history — and against your lifespan?" },
  { key: "spending", label: "Spending rules", icon: "tune", question: "How would your spending have moved under different withdrawal rules, and what does other income add?" },
]

export default function FireResearchPage() {
  const [tab, setTab] = useState<LabTab>("rates")
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

  const eq = simOptions.equity
  const mix = eq.glideMonths > 0
    ? `${Math.round(eq.start * 100)}→${Math.round(eq.end * 100)}% stocks`
    : `${Math.round(eq.start * 100)}% stocks${eq.cash ? `, ${Math.round(eq.cash * 100)}% cash` : ""}`

  return (
    <div className="space-y-6">
      <p className="text-xs text-foreground-muted">
        Testing your plan — {fmtPct(plan.swr, 2)} withdrawals, {inputs.horizonYears} years, {mix},{" "}
        {Math.round(inputs.finalValueTarget * 100)}% final value — against every month from 1871 to{" "}
        {fmtMonth(history.dataThrough)}. Methodology after Big ERN&apos;s{" "}
        <a href="https://earlyretirementnow.com/safe-withdrawal-rate-series/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          Safe Withdrawal Rate Series
        </a>
        ; data from Robert Shiller.
      </p>

      <div role="tablist" aria-label="Lab sections" className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {LAB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground hover:bg-foreground/5",
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground-muted -mt-3">{LAB_TABS.find((t) => t.key === tab)?.question}</p>

      {tab === "rates" && (
        <>
          <SwrHeatmap history={history} probeWr={plan.swr} />
          <MaxWrByYearChart summaries={summaries} wr={plan.swr} horizonYears={inputs.horizonYears} />
          <CapeRuleCard state={state} isHidden={isHidden} />
          <GlidepathCompare history={history} opts={simOptions} wr={plan.swr} />
        </>
      )}
      {tab === "stress" && (
        <>
          <CohortPathsChart history={history} wr={plan.swr} opts={simOptions} portfolio={analysis.fireNumber} isHidden={isHidden} />
          <SequenceRiskChart summaries={summaries} wr={plan.swr} />
          <RichBrokeDeadCard state={state} />
        </>
      )}
      {tab === "spending" && (
        <>
          <WithdrawalStrategiesCard state={state} isHidden={isHidden} />
          <SupplementalFlowsCard
            history={history}
            opts={simOptions}
            flows={inputs.flows}
            annualSpend={plan.annualSpend}
            retireAge={analysis.retireAge}
          />
        </>
      )}
    </div>
  )
}
