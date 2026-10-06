"use client"

import Link from "next/link"
import { HeaderTools } from "@/components/layout/header-tools"
import { BasicAdvancedToggle } from "@/components/ui/basic-advanced-toggle"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { PlanGuideButton } from "./guide/plan-guide-dialog"
import { EditLayoutButton } from "./plan-layout"

/** Top of a single plan: its tools (Basic/Advanced, guide, layout) up in the top bar, then the back link, the name and its pages. */
export function PlanEditorHeader({
  planId,
  name,
  isPrimary,
  isSaving,
  editingLayout,
  onEditLayout,
  onResetLayout,
}: {
  planId: string
  name: string
  isPrimary: boolean
  isSaving: boolean
  editingLayout: boolean
  onEditLayout: () => void
  onResetLayout: () => void
}) {
  const { mode, setMode, isBasic } = usePlanMode()
  return (
    <div className="space-y-2">
      <HeaderTools>
        <BasicAdvancedToggle mode={mode} onChange={setMode} label="Planner mode" />
        <PlanGuideButton />
        {!isBasic && <EditLayoutButton editing={editingLayout} onToggle={onEditLayout} onReset={onResetLayout} />}
      </HeaderTools>
      <Link href="/plans" className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
          arrow_back
        </span>
        All plans
      </Link>
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-2xl text-foreground font-semibold truncate">{name}</h1>
        {isPrimary && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">
            Primary
          </span>
        )}
        <span className="text-[11px] text-foreground-muted">{isSaving ? "Saving…" : "Saved"}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/plans/${planId}/cashflow`} className="btn-secondary text-xs inline-flex items-center gap-1.5">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            account_tree
          </span>
          Money flow
        </Link>
        <Link href={`/plans/${planId}/whatif`} className="btn-secondary text-xs inline-flex items-center gap-1.5">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
            tune
          </span>
          What if
        </Link>
        {!isBasic && (
          <>
            <Link href={`/plans/${planId}/trading`} className="btn-secondary text-xs inline-flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                candlestick_chart
              </span>
              Trading
            </Link>
            <Link href={`/plans/${planId}/loans`} className="btn-secondary text-xs inline-flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                request_quote
              </span>
              Loans
            </Link>
            <Link href={`/plans/${planId}/stress`} className="btn-secondary text-xs inline-flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                thunderstorm
              </span>
              Stress test
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
