"use client"

import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDocument } from "@/hooks/plans/use-plan-document"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { tradingAccounts } from "@/lib/plans/plan-trading-compare"
import { PlanTradingAccounts } from "./plan-trading-accounts"
import { PlanTradingCard } from "./plan-trading-card"
import { PlanTradingSuggestions } from "./plan-trading-suggestions"

/** A plan's trading page: its actively traded accounts, and whether trading them beats holding. */
export function PlanTradingView({ planId }: { planId: string }) {
  const { plan, document: doc, update, isLoading } = usePlanDocument(planId)
  const { isHidden } = usePrivacyMode()

  if (isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!plan || !doc) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={`/plans/${planId}`} className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs text-foreground-muted hover:text-foreground lg:min-h-0">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            arrow_back
          </span>
          {plan.name}
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl text-foreground font-semibold">Trading</h1>
          <p className="text-xs text-foreground-muted mt-0.5">What active trading costs in tax, and how much better than holding it has to do</p>
        </div>
      </div>
      <PlanTradingSuggestions doc={doc} update={update} />
      <PlanTradingAccounts doc={doc} planId={planId} isHidden={isHidden} />
      {tradingAccounts(doc).length > 0 && <PlanTradingCard doc={doc} isHidden={isHidden} />}
    </div>
  )
}
