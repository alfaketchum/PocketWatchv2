"use client"

import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDocument } from "@/hooks/plans/use-plan-document"
import { usePlanProjection } from "@/hooks/plans/use-plan-projection"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { StressTestView } from "./stress-test-view"

/** A plan's stress test page: the whole plan through simulated markets, or replayed through every market since 1871. */
export function PlanStressPage({ planId }: { planId: string }) {
  const { plan, document: doc, update, isLoading } = usePlanDocument(planId)
  const { projection } = usePlanProjection(doc)
  const { isHidden } = usePrivacyMode()

  if (isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!plan || !doc || !projection) {
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
          <h1 className="text-xl sm:text-2xl text-foreground font-semibold">Stress test</h1>
          <p className="text-xs text-foreground-muted mt-0.5">Your plan through markets built from history since 1871</p>
        </div>
      </div>
      <StressTestView doc={doc} update={update} projection={projection} isHidden={isHidden} />
    </div>
  )
}
