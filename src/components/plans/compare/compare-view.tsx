"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { useComparePlans } from "@/hooks/plans/use-compare-plans"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"
import { DEFAULT_SAMPLING } from "@/lib/plans/stress/stress-sampling"
import { summarize } from "@/lib/plans/stress/stress-test"
import { useStressTest } from "../stress/use-stress-test"
import { usePlanColors } from "../results/use-plan-colors"
import { CompareInputsDiff } from "./compare-inputs-diff"
import { ComparePickers } from "./compare-pickers"
import { CompareTable, type Safety } from "./compare-table"

const CompareCharts = dynamic(() => import("./compare-charts").then((m) => m.CompareCharts), {
  ssr: false,
  loading: () => <div className="h-[760px] animate-shimmer rounded-2xl" />,
})

/** "B runs 5 more years" when the two plans end in different years. */
function lengthNote(a: YearRow[], b: YearRow[]): string | null {
  const endA = a[a.length - 1]?.year
  const endB = b[b.length - 1]?.year
  if (endA === undefined || endB === undefined || endA === endB) return null
  const [longer, years] = endB > endA ? ["B", endB - endA] : ["A", endA - endB]
  return `${longer} runs ${years} more year${years === 1 ? "" : "s"} (to ${Math.max(endA, endB)})`
}

/** Plan A against plan B: what's different in the inputs, then what that does to every chart. */
/** A plan's rates through the default simulated markets (null while loading or running). */
function useSafety(doc: PlanDocument | null): Safety | null {
  const { cohorts, running } = useStressTest(doc, "start", "plan", DEFAULT_SAMPLING)
  return useMemo(() => {
    if (!cohorts || running || cohorts.length === 0) return null
    const s = summarize(cohorts, null)
    return { netWorth: s.netWorthRate, cash: s.successRate }
  }, [cohorts, running])
}

export function CompareView() {
  const { plans, isLoading, error, aId, bId, setA, setB, swap, basis, setBasis, a, b } = useComparePlans()
  const { isHidden } = usePrivacyMode()
  const { series } = usePlanColors()
  const colors: [string, string] = [series[0], series[1]]
  const { isBasic } = usePlanMode()
  const safety: [Safety | null, Safety | null] = [useSafety(a.plan?.document ?? null), useSafety(b.plan?.document ?? null)]
  // Basic always shows today's dollars (its toggle is Advanced).
  useEffect(() => {
    if (isBasic) setBasis("today")
  }, [isBasic, setBasis])

  if (isLoading && plans.length === 0) return <div className="h-[420px] animate-shimmer rounded-2xl" />
  if (error) return <EmptyState icon="error" title="Couldn't load your plans" description="Refresh the page to try again." />
  if (plans.length < 2) {
    return (
      <EmptyState
        icon="compare_arrows"
        title="Make a second plan to compare"
        description="Duplicate a plan, change one thing (retire earlier, buy a house), and compare the two here."
        action={{ label: "Go to plans", href: "/plans" }}
      />
    )
  }

  const pickers = <ComparePickers plans={plans} aId={aId} bId={bId} colors={colors} onA={setA} onB={setB} onSwap={swap} />
  if (!a.plan || !b.plan || !a.view || !b.view || !a.projection || !b.projection || !a.summary || !b.summary) {
    return (
      <div className="space-y-5">
        {pickers}
        <div className="h-[760px] animate-shimmer rounded-2xl" />
      </div>
    )
  }
  return (
    <div className="space-y-5">
      {pickers}
      <CompareInputsDiff a={a.plan.document} b={b.plan.document} colors={colors} note={lengthNote(a.rows, b.rows)} isHidden={isHidden} />
      <CompareTable a={a.summary} b={b.summary} names={[a.plan.name, b.plan.name]} colors={colors} safety={safety} isHidden={isHidden} />
      <CompareCharts
        a={{ name: a.plan.name, view: a.view, projection: a.projection, rows: a.rows }}
        b={{ name: b.plan.name, view: b.view, projection: b.projection, rows: b.rows }}
        colors={colors}
        basis={basis}
        onBasisChange={setBasis}
        isHidden={isHidden}
      />
    </div>
  )
}
