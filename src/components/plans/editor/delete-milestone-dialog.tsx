"use client"

import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import {
  detachMilestone,
  milestoneCreations,
  milestoneUses,
  removeMilestoneWithItems,
} from "@/lib/plans/plan-milestone-uses"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanEditorProps } from "../plans-helpers"

/** Confirm deleting a milestone: remove everything its template added, or keep those items fixed to its year. */
export function DeleteMilestoneDialog({ doc, update, id, onClose }: PlanEditorProps & { id: string; onClose: () => void }) {
  const milestone = doc.milestones.find((m) => m.id === id)
  if (!milestone) return null
  const created = milestoneCreations(doc, id)
  const createdSet = new Set(created.map((c) => c.replace(/ \((income|expense|received|account|asset|debt|person|milestone)\)$/, "")))
  const otherUses = milestoneUses(doc, id).filter((u) => ![...createdSet].some((c) => u.startsWith(c)))
  const index = resolveTiming(milestone.timing, timingContext(doc))
  const year = doc.settings.startYear + Math.max(0, index ?? 0)
  const done = (fn: typeof detachMilestone) => {
    update((d) => fn(d, id))
    onClose()
  }

  return (
    <AccountsModalShell
      title={`Delete "${milestone.name}"?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm mr-auto">
            Cancel
          </button>
          {created.length > 0 && (
            <button type="button" onClick={() => done(detachMilestone)} className="btn-secondary text-sm">
              Keep them ({year})
            </button>
          )}
          <button
            type="button"
            onClick={() => done(created.length > 0 ? removeMilestoneWithItems : detachMilestone)}
            className="btn-primary text-sm"
          >
            {created.length > 0 ? `Remove all ${created.length + 1}` : "Delete"}
          </button>
        </>
      }
    >
      {created.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm text-foreground">It added these to your plan:</p>
          <ul className="list-disc pl-5 text-xs text-foreground-muted">
            {created.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-xs text-foreground-muted">
            <span className="font-medium text-foreground">Remove all</span> takes them out too (a salary it ended picks back up).{" "}
            <span className="font-medium text-foreground">Keep them</span> leaves them in, fixed to {year}.
          </p>
        </div>
      )}
      {otherUses.length > 0 && (
        <p className="text-xs text-foreground-muted">
          Also tied to it, and kept at {year}: {otherUses.join(" · ")}
        </p>
      )}
      {created.length === 0 && otherUses.length === 0 && <p className="text-sm text-foreground-muted">Nothing else is tied to it.</p>}
    </AccountsModalShell>
  )
}
