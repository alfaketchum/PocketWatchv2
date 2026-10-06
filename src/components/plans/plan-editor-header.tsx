"use client"

import Link from "next/link"
import { HeaderTools, TOOLBAR_CLASS } from "@/components/layout/header-tools"
import { BasicAdvancedToggle } from "@/components/ui/basic-advanced-toggle"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { EditLayoutButton } from "./plan-layout"

/** Top of a single plan: its tools (Basic/Advanced, layout) up in the top bar, then the back link and the name. */
export function PlanEditorHeader({
  name,
  isPrimary,
  isSaving,
  editingLayout,
  onEditLayout,
  onResetLayout,
}: {
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
        <div className={TOOLBAR_CLASS}>
          <BasicAdvancedToggle mode={mode} onChange={setMode} label="Planner mode" bare />
          {!isBasic && (
            <>
              <span className="mx-1 h-5 w-px bg-card-border" aria-hidden="true" />
              <EditLayoutButton editing={editingLayout} onToggle={onEditLayout} onReset={onResetLayout} />
            </>
          )}
        </div>
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
    </div>
  )
}
