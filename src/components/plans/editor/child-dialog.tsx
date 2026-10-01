"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { newChild } from "@/lib/plans/plan-children"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { mergeChildDraft } from "@/lib/plans/plan-edits"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { newItemId, type DocUpdater, type PlanEditorProps } from "../plans-helpers"
import { ChildFields } from "./child-fields"

/** A new child's starting draft: next year's birth unless they're already born. */
function draftWithChild(doc: PlanDocument): { draft: PlanDocument; childId: string } {
  const childId = newItemId("kid")
  const count = doc.children.length
  const child = newChild(childId, count === 0 ? "First child" : `Child ${count + 1}`, doc.settings.startYear + 1)
  return { draft: { ...doc, children: [...doc.children, child] }, childId }
}

/**
 * A child in a pop-out with every field: add one (no `childId`) or edit one. It works on a draft copy of the plan, so
 * turning on a 529 doesn't touch the plan until Add or Save; Cancel leaves nothing behind.
 */
export function ChildDialog({ doc, update, childId, onClose }: Pick<PlanEditorProps, "doc" | "update"> & { childId?: string; onClose: () => void }) {
  const [start] = useState(() => (childId ? { draft: doc, childId } : draftWithChild(doc)))
  const [draft, setDraft] = useState<PlanDocument>(start.draft)
  const editDraft = (updater: DocUpdater) => setDraft((d) => updater(d))
  const child = draft.children.find((c) => c.id === start.childId)
  const adding = !childId
  const full = adding && doc.children.length >= PLAN_LIMITS.children

  const save = () => {
    if (!child || full) return
    update((d) => mergeChildDraft(d, draft, start.childId))
    toast.success(adding ? `Added ${child.name || "your child"} to Expenses → Kids` : `Saved ${child.name || "your child"}`)
    onClose()
  }

  return (
    <AccountsModalShell
      wide
      title={adding ? "Have a child" : `Edit ${child?.name || "child"}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm mr-auto">
            Cancel
          </button>
          {full && <span className="self-center text-xs text-foreground-muted">This plan has the most children it can hold.</span>}
          <button type="button" onClick={save} disabled={full || !child} className="btn-primary text-sm disabled:opacity-50">
            {adding ? "Add" : "Save"}
          </button>
        </>
      }
    >
      {child && (
        <div className="space-y-3">
          <p className="text-xs text-foreground-muted">A child born or planned: raising costs, college, a 529 and help after college. Each becomes its own expense lines and milestones.</p>
          <ChildFields child={child} doc={draft} update={editDraft} />
        </div>
      )}
    </AccountsModalShell>
  )
}
