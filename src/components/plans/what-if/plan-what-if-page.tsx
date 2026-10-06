"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { useCreatePlan } from "@/hooks/plans/use-plans-list"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { useWhatIf } from "@/hooks/plans/use-what-if"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { CompareInputsDiff } from "../compare/compare-inputs-diff"
import { CompareTable } from "../compare/compare-table"
import { PlanNameDialog } from "../plan-name-dialog"
import { usePlanColors } from "../results/use-plan-colors"
import { WhatIfDials } from "./what-if-dials"
import { WhatIfPhoneSummary } from "./what-if-phone-summary"

const CompareCharts = dynamic(() => import("../compare/compare-charts").then((m) => m.CompareCharts), {
  ssr: false,
  loading: () => <div className="h-[760px] animate-shimmer rounded-2xl" />,
})

const NAMES: [string, string] = ["Your plan", "What if"]

/** Try changes on a copy of a plan (never saved unless asked) and see what they do, next to the plan as it is. */
export function PlanWhatIfPage({ planId }: { planId: string }) {
  const { plan, isLoading, dials, setDials, whatIfDoc, basis, setBasis, a, b } = useWhatIf(planId)
  const { isHidden } = usePrivacyMode()
  const { series } = usePlanColors()
  const colors: [string, string] = [series[0], series[1]]
  const { isBasic } = usePlanMode()
  const [saving, setSaving] = useState(false)
  const create = useCreatePlan()
  const router = useRouter()
  // Basic always shows today's dollars (its toggle is Advanced).
  useEffect(() => {
    if (isBasic) setBasis("today")
  }, [isBasic, setBasis])

  if (isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!plan) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }

  const save = (name: string) => {
    if (!whatIfDoc) return
    create.mutate(
      { from: "import", name, document: whatIfDoc },
      {
        onSuccess: ({ plan: created }) => {
          setSaving(false)
          toast.success(`Saved "${name}"`, {
            action: { label: "Compare", onClick: () => router.push(`/plans/compare?a=${planId}&b=${created.id}`) },
            cancel: { label: "Open", onClick: () => router.push(`/plans/${created.id}`) },
          })
        },
      },
    )
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
          <h1 className="text-xl sm:text-2xl text-foreground font-semibold">What if…</h1>
          <p className="text-xs text-foreground-muted mt-0.5">Try changes without touching your plan. Save one as a new plan if you like it.</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-4">
          <WhatIfDials doc={plan.document} dials={dials} onChange={setDials} onSave={() => setSaving(true)} />
        </div>
        {a.view && b.view && a.projection && b.projection && a.summary && b.summary && whatIfDoc ? (
          <div className="min-w-0 space-y-5">
            <CompareTable a={a.summary} b={b.summary} names={NAMES} colors={colors} isHidden={isHidden} />
            <CompareInputsDiff a={plan.document} b={whatIfDoc} colors={colors} note={null} isHidden={isHidden} emptyTitle="Move a dial to see what changes" />
            <CompareCharts
              a={{ name: NAMES[0], view: a.view, projection: a.projection, rows: a.rows }}
              b={{ name: NAMES[1], view: b.view, projection: b.projection, rows: b.rows }}
              colors={colors}
              basis={basis}
              onBasisChange={setBasis}
              isHidden={isHidden}
            />
          </div>
        ) : (
          <div className="h-[760px] animate-shimmer rounded-2xl" />
        )}
      </div>
      {a.summary && b.summary && <WhatIfPhoneSummary a={a.summary} b={b.summary} isHidden={isHidden} />}
      {saving && (
        <PlanNameDialog
          title="Save as a new plan"
          initialName={`${plan.name} – what if`.slice(0, 80)}
          submitLabel="Save"
          isPending={create.isPending}
          onSubmit={save}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  )
}
