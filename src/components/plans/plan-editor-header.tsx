"use client"

import Link from "next/link"
import type { DollarBasis } from "@/lib/plans/plan-types"
import { PlanGuideButton } from "./guide/plan-guide-dialog"
import { EditLayoutButton } from "./plan-layout"
import { DollarsToggle } from "./results/dollars-toggle"

/** Links to the plan's own pages, in the accent tint so they stand out from the plain controls. */
const PAGE_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"

/** Top of a single plan: back link, name, save state and dollar basis. */
export function PlanEditorHeader({
  planId,
  name,
  isPrimary,
  isSaving,
  basis,
  onBasisChange,
  editingLayout,
  onEditLayout,
  onResetLayout,
}: {
  planId: string
  name: string
  isPrimary: boolean
  isSaving: boolean
  basis: DollarBasis
  onBasisChange: (basis: DollarBasis) => void
  editingLayout: boolean
  onEditLayout: () => void
  onResetLayout: () => void
}) {
  return (
    <div className="space-y-2">
      <Link href="/plans" className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
          arrow_back
        </span>
        All plans
      </Link>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-2xl text-foreground font-semibold truncate">{name}</h1>
          {isPrimary && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">
              Primary
            </span>
          )}
          <span className="text-[11px] text-foreground-muted">{isSaving ? "Saving…" : "Saved"}</span>
          <PlanGuideButton />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/plans/${planId}/cashflow`} className={PAGE_LINK}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              account_tree
            </span>
            Money flow
          </Link>
          <Link href={`/plans/${planId}/trading`} className={PAGE_LINK}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              candlestick_chart
            </span>
            Trading
          </Link>
          <Link href={`/plans/${planId}/loans`} className={PAGE_LINK}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              request_quote
            </span>
            Loans
          </Link>
          <Link href={`/plans/${planId}/stress`} className={PAGE_LINK}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              thunderstorm
            </span>
            Stress test
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditLayoutButton editing={editingLayout} onToggle={onEditLayout} onReset={onResetLayout} />
          <DollarsToggle value={basis} onChange={onBasisChange} />
        </div>
      </div>
    </div>
  )
}
