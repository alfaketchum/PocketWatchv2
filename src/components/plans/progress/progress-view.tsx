"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { usePlanDetail } from "@/hooks/plans/use-plan-document"
import { usePlansList } from "@/hooks/plans/use-plans-list"
import { useCombinedNetWorth } from "@/hooks/use-combined-net-worth"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { nowFractionalYear } from "@/lib/fire/fire-history"
import { simulatePlan } from "@/lib/plans/engine/simulate"
import { monthlyActual, planPath, progressStatus, type ProgressStatus } from "@/lib/plans/plan-progress"

const ProgressChart = dynamic(() => import("./progress-chart").then((m) => m.ProgressChart), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-shimmer rounded-2xl" />,
})

function StatusLine({ status, planStart, isHidden }: { status: ProgressStatus | null; planStart: string; isHidden: boolean }) {
  if (!status) {
    return <p className="text-sm text-foreground-muted">The plan starts {planStart}. Check back once some time has passed.</p>
  }
  const ahead = status.difference >= 0
  const pct = status.planned !== 0 ? Math.abs(status.difference / status.planned) : 0
  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Where you stand</p>
      <p className={`text-2xl font-semibold mt-1 ${ahead ? "text-success" : "text-error"}`} style={isHidden ? { filter: "blur(8px)" } : undefined}>
        {fmtMoney(Math.abs(status.difference))} {ahead ? "ahead of" : "behind"} plan
      </p>
      <p className="text-xs text-foreground-muted mt-1" style={isHidden ? { filter: "blur(6px)" } : undefined}>
        Actual {fmtMoney(status.actual)} vs planned {fmtMoney(status.planned)} ({(pct * 100).toFixed(1)}% {ahead ? "ahead" : "behind"})
      </p>
    </div>
  )
}

/** The primary plan's path from its start date against real net-worth history. */
export function ProgressView() {
  const list = usePlansList()
  const { isHidden } = usePrivacyMode()
  const primary = list.data?.plans.find((p) => p.isPrimary) ?? null
  const detail = usePlanDetail(primary?.id ?? "")
  const netWorth = useCombinedNetWorth("all")
  const doc = detail.data?.document ?? null

  const path = useMemo(() => (doc ? planPath(doc, simulatePlan(doc)) : []), [doc])
  // The plan's line is financial net worth, so leave out homes and vehicles valued by hand.
  const actual = useMemo(
    () => monthlyActual((netWorth.data?.history ?? []).map((p) => ({ date: p.date, total: p.total - (p.real ?? 0) }))),
    [netWorth.data],
  )
  const status = useMemo(() => progressStatus(path, actual), [path, actual])
  const now = nowFractionalYear(new Date())

  if (list.isLoading || (primary && (detail.isLoading || netWorth.isLoading))) {
    return <div className="h-[420px] animate-shimmer rounded-2xl" />
  }
  if (!primary || !doc) {
    return (
      <EmptyState
        icon="track_changes"
        title="No primary plan yet"
        description="Create a plan and it becomes your primary plan. This page then tracks your real net worth against it."
        action={{ label: "Go to plans", href: "/plans" }}
      />
    )
  }
  const planStart = new Date(doc.settings.startYear, doc.settings.startMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="space-y-5">
      <p className="text-xs text-foreground-muted">
        Tracking{" "}
        <Link href={`/plans/${primary.id}`} className="font-medium text-primary hover:underline">
          {primary.name}
        </Link>
        , your primary plan, from {planStart}.
      </p>
      <StatusLine status={status} planStart={planStart} isHidden={isHidden} />
      <ProgressChart actual={actual} plan={path} now={now} isHidden={isHidden} />
      {doc.assets.length > 0 && (
        <p className="text-[11px] text-foreground-muted">
          This plan includes a home or other assets. Both lines leave their value out (financial net worth only, even for homes and
          vehicles on Homes &amp; Vehicles), so the plan line dips when a purchase or its loan starts.
        </p>
      )}
      {netWorth.error && <p className="text-xs text-error">Couldn&apos;t load your net-worth history: {netWorth.error.message}</p>}
    </div>
  )
}
