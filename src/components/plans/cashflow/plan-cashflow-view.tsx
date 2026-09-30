"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { usePlanDetail } from "@/hooks/plans/use-plan-document"
import { usePlanProjection } from "@/hooks/plans/use-plan-projection"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { cashFlowFor } from "@/lib/plans/plan-chart"
import { planSankey } from "@/lib/plans/plan-sankey"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import { primaryAge } from "../plans-helpers"
import { DollarsToggle } from "../results/dollars-toggle"

const PlanSankeyChart = dynamic(() => import("./plan-sankey-chart").then((m) => m.PlanSankeyChart), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-shimmer rounded-2xl" />,
})

function Stat({ label, value, isHidden }: { label: string; value: number; isHidden: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      <p className="text-base font-semibold tabular-nums text-foreground" style={isHidden ? { filter: "blur(6px)" } : undefined}>
        {fmtMoney(value)}
      </p>
    </div>
  )
}

function YearPicker({
  index,
  count,
  label,
  jumps,
  onChange,
}: {
  index: number
  count: number
  label: string
  jumps: { label: string; index: number }[]
  onChange: (index: number) => void
}) {
  const step = (delta: number) => onChange(Math.min(count - 1, Math.max(0, index + delta)))
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous year" className="btn-ghost h-8 px-1.5 disabled:opacity-30">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
            chevron_left
          </span>
        </button>
        <span className="min-w-[8.5rem] text-center text-sm font-semibold text-foreground tabular-nums">{label}</span>
        <button type="button" onClick={() => step(1)} disabled={index === count - 1} aria-label="Next year" className="btn-ghost h-8 px-1.5 disabled:opacity-30">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
            chevron_right
          </span>
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={count - 1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Plan year"
        className="min-w-[10rem] flex-1 accent-[var(--primary)]"
      />
      <div className="flex gap-1.5">
        {jumps.map((j) => (
          <button key={j.label} type="button" onClick={() => onChange(j.index)} className="rounded-lg border border-card-border px-2.5 py-1 text-[11px] text-foreground-muted hover:text-foreground">
            {j.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A plan's money for one year as a Sankey, with a year picker. */
export function PlanCashflowView({ planId }: { planId: string }) {
  const detail = usePlanDetail(planId)
  const { isHidden } = usePrivacyMode()
  const { rows, basis, setBasis, view: doc } = usePlanProjection(detail.data?.document ?? null)
  const [index, setIndex] = useState(0)

  const retireIndex = useMemo(() => {
    const retirement = doc?.milestones.find((m) => m.kind === "retirement")
    return doc && retirement ? resolveTiming(retirement.timing, timingContext(doc)) : null
  }, [doc])
  const row = rows[Math.min(index, rows.length - 1)]
  const age = doc && row ? primaryAge(doc) + row.index : 0
  const sankey = useMemo(() => (doc && row ? planSankey(doc, row, age) : null), [doc, row, age])
  const flow = useMemo(() => (doc && row ? cashFlowFor(doc, row, age) : null), [doc, row, age])

  if (detail.isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!detail.data || !doc || !row || !sankey || !flow) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }

  const jumps = [
    { label: "This year", index: 0 },
    ...(retireIndex !== null && retireIndex >= 0 && retireIndex < rows.length ? [{ label: "Retirement", index: retireIndex }] : []),
  ]
  const withdrawals = flow.wdCash + flow.wdTaxable + flow.wdTaxDeferred + flow.wdTaxFree

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
            <h1 className="text-2xl text-foreground font-semibold">Money flow</h1>
            <p className="text-xs text-foreground-muted mt-0.5">Where each year&apos;s money comes from and where it goes</p>
          </div>
          <DollarsToggle value={basis} onChange={setBasis} />
        </div>
      </div>
      <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <YearPicker index={row.index} count={rows.length} label={`Age ${age} · ${row.year}`} jumps={jumps} onChange={setIndex} />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Stat label="Income" value={flow.income} isHidden={isHidden} />
          <Stat label="Withdrawals" value={withdrawals} isHidden={isHidden} />
          <Stat label="Taxes" value={-flow.taxes} isHidden={isHidden} />
          <Stat label="Spending" value={-flow.spending} isHidden={isHidden} />
          <Stat label="Contributions" value={-flow.saved} isHidden={isHidden} />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]" style={isHidden ? { filter: "blur(8px)" } : undefined}>
            <PlanSankeyChart sankey={sankey} isHidden={isHidden} />
          </div>
        </div>
        <p className="text-[11px] text-foreground-muted">
          {basis === "today" ? "Today's dollars." : "Future dollars."} Employer match isn&apos;t shown: it goes straight into your accounts without passing
          through your cash flow.
        </p>
      </div>
    </div>
  )
}
