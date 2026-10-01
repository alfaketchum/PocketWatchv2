"use client"

import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDetail } from "@/hooks/plans/use-plan-document"
import { usePlanProjection } from "@/hooks/plans/use-plan-projection"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { DollarsToggle } from "../results/dollars-toggle"
import { PlanLedgerTable } from "../results/plan-ledger-table"
import { StressOverviewCard } from "../stress/stress-overview-card"

/** A plan's year-by-year ledger, with the stress test's headline. */
export function PlanLedgerView({ planId }: { planId: string }) {
  const detail = usePlanDetail(planId)
  const { isHidden } = usePrivacyMode()
  const document = detail.data?.document ?? null
  const { rows, basis, setBasis, view } = usePlanProjection(document)

  if (detail.isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!detail.data || !document || !view) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={`/plans/${planId}`} className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            arrow_back
          </span>
          {detail.data.name}
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl text-foreground font-semibold">Ledger</h1>
            <p className="text-xs text-foreground-muted mt-0.5">Every year of the plan: money in, money out, and what you own and owe</p>
          </div>
          <DollarsToggle value={basis} onChange={setBasis} />
        </div>
      </div>
      <StressOverviewCard doc={document} planId={planId} />
      <PlanLedgerTable doc={view} rows={rows} basis={basis} isHidden={isHidden} fileName={detail.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} />
    </div>
  )
}
