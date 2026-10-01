"use client"

import { useState } from "react"
import { InputBlock } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanChild } from "@/lib/plans/plan-types"
import { removeChild } from "@/lib/plans/plan-edits"
import { planItemAnchor, type PlanEditorProps } from "../plans-helpers"
import { ChildDialog } from "./child-dialog"
import { ChildFields } from "./child-fields"
import { AddButton, ItemCard } from "./plan-editor-controls"
import { RowButton } from "./plan-table"

function ChildCard({ child, doc, update }: { child: PlanChild } & PlanEditorProps) {
  return (
    <ItemCard
      anchorId={planItemAnchor(child.id)}
      title={`${child.name || "Child"} · born ${child.birthYear}`}
      removeLabel={`Remove ${child.name}`}
      onRemove={() => update((d) => removeChild(d, child.id))}
    >
      <ChildFields child={child} doc={doc} update={update} />
    </ItemCard>
  )
}

/** One line per child for the compact view: what's planned for them, with Edit (the pop-out) and Remove. */
function KidRow({ child, onEdit, onRemove }: { child: PlanChild; onEdit: () => void; onRemove: () => void }) {
  const parts = [
    child.raising.enabled && `raising ${fmtMoney(child.raising.annualCost)}/yr to ${child.raising.untilAge}`,
    child.college.enabled && `college at ${child.college.startAge}`,
    child.plan529.enabled && "529",
    child.support.enabled && `support ${child.support.years} yrs`,
  ].filter(Boolean)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-card-border px-3 py-2">
      <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }} aria-hidden="true">
        child_care
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {child.name || "Child"} <span className="text-foreground-muted">· born {child.birthYear}</span>
        </p>
        <p className="truncate text-[11px] text-foreground-muted">{parts.length > 0 ? parts.join(" · ") : "No costs set"}</p>
      </div>
      <RowButton icon="edit" label={`Edit ${child.name}`} onClick={onEdit} />
      <RowButton icon="delete" label={`Remove ${child.name}`} danger onClick={onRemove} />
    </div>
  )
}

/**
 * Kids: each one brings raising costs, optional college, a 529 and support, plus milestones. Adding (and, in the
 * compact view, editing) uses the pop-out with every field; the detailed view edits each child on its card.
 */
export function ChildrenEditor({ doc, update, view }: PlanEditorProps) {
  const children = doc.children ?? []
  const [dialog, setDialog] = useState<{ childId?: string } | null>(null)
  return (
    <div id={planItemAnchor("kids")} className="scroll-mt-24">
      <InputBlock
        title="Kids"
        description="Add a child (born or planned) to project raising costs, college, a 529 plan and support after college. Each shows up as its own expense lines and milestones."
      >
        {view === "compact"
          ? children.map((c) => (
              <KidRow key={c.id} child={c} onEdit={() => setDialog({ childId: c.id })} onRemove={() => update((d) => removeChild(d, c.id))} />
            ))
          : children.map((c) => <ChildCard key={c.id} child={c} doc={doc} update={update} />)}
        <AddButton label="Add a child" disabled={children.length >= PLAN_LIMITS.children} onClick={() => setDialog({})} />
      </InputBlock>
      {dialog && <ChildDialog doc={doc} update={update} childId={dialog.childId} onClose={() => setDialog(null)} />}
    </div>
  )
}
