"use client"

import Link from "next/link"
import type { DollarBasis } from "@/lib/plans/plan-types"
import { DollarsToggle } from "./results/dollars-toggle"

/** Top of a single plan: back link, name, save state and dollar basis. */
export function PlanEditorHeader({
  planId,
  name,
  isPrimary,
  isSaving,
  basis,
  onBasisChange,
}: {
  planId: string
  name: string
  isPrimary: boolean
  isSaving: boolean
  basis: DollarBasis
  onBasisChange: (basis: DollarBasis) => void
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
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/plans/${planId}/cashflow`} className="btn-secondary text-xs">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            account_tree
          </span>
          Cash flow Sankey
        </Link>
        <DollarsToggle value={basis} onChange={onBasisChange} />
      </div>
    </div>
  )
}
