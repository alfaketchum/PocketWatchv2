"use client"

import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDetail } from "@/hooks/plans/use-plan-document"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { tradingAccounts } from "@/lib/plans/plan-trading-compare"
import { PlanTradingAccounts } from "./plan-trading-accounts"
import { PlanTradingCard } from "./plan-trading-card"

/** A plan's trading page: its actively traded accounts, and whether trading them beats holding. */
export function PlanTradingView({ planId }: { planId: string }) {
  const detail = usePlanDetail(planId)
  const { isHidden } = usePrivacyMode()

  if (detail.isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!detail.data) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }
  const doc = detail.data.document
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={`/plans/${planId}`} className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            arrow_back
          </span>
          {detail.data.name}
        </Link>
        <div>
          <h1 className="text-2xl text-foreground font-semibold">Trading</h1>
          <p className="text-xs text-foreground-muted mt-0.5">What active trading costs in tax, and how much better than holding it has to do</p>
        </div>
      </div>
      <PlanTradingAccounts doc={doc} planId={planId} isHidden={isHidden} />
      {tradingAccounts(doc).length > 0 && <PlanTradingCard doc={doc} isHidden={isHidden} />}
    </div>
  )
}
