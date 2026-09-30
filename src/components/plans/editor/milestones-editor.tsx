"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { FI_SAFE_WITHDRAWAL_RATE, PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { fiMilestone } from "@/lib/plans/plan-fi-milestone"
import { milestoneSource, milestoneUses, MILESTONE_SOURCE_LABELS } from "@/lib/plans/plan-milestone-uses"
import { generatedMilestones } from "@/lib/plans/plan-milestones"
import { payoffMilestones } from "@/lib/plans/plan-payoff-milestones"
import { milestoneGroup } from "@/lib/plans/plan-chart"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanDocument, PlanMilestone } from "@/lib/plans/plan-types"
import { fmtMoney, fmtPct } from "@/components/fire/fire-helpers"
import { patchItem, planItemAnchor, primaryAge, type PlanEditorProps } from "../plans-helpers"
import { usePlanColors } from "../results/use-plan-colors"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import { DeleteMilestoneDialog } from "./delete-milestone-dialog"
import { AddButton, EditorToolbar, ItemCard, TextField } from "./plan-editor-controls"
import { Badge } from "./plan-table"
import { TimingPicker } from "./timing-picker"
import { MilestonesTable } from "./milestones-table"

/** "Used by: Salary stops · Tax rates change", or a hint when nothing points here yet. */
function UsedBy({ uses }: { uses: string[] }) {
  return (
    <p className="text-[11px] text-foreground-muted">
      {uses.length > 0 ? `Used by: ${uses.join(" · ")}` : "Nothing is tied to this yet. Pick it as a start or stop anywhere in the plan."}
    </p>
  )
}

function whenLabel(doc: PlanDocument, milestone: PlanMilestone): string {
  const index = resolveTiming(milestone.timing, timingContext(doc))
  if (index === null) return "Can't be placed (check what it points at)"
  return `${doc.settings.startYear + index} · age ${primaryAge(doc) + index}`
}

/** Read-only financial-independence mark: accounts reaching average yearly spending ÷ the SWR. */
function FiMilestoneCard({ doc }: { doc: PlanDocument }) {
  const { milestones: groupColors } = usePlanColors()
  const fi = useMemo(() => fiMilestone(doc), [doc])
  if (!fi) return null
  return (
    <div className="rounded-xl border border-dashed border-card-border p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">Financial independence</p>
      <p className="text-[11px] text-foreground-muted">
        Your plan averages {fmtMoney(fi.averageExpenses)} of spending a year, which needs {fmtMoney(fi.target)} invested at a{" "}
        {fmtPct(FI_SAFE_WITHDRAWAL_RATE, 1)} withdrawal rate. Read-only — it moves with your plan.
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className="material-symbols-rounded" style={{ fontSize: 15, color: groupColors[milestoneGroup(fi.milestone)] }}>
          {fi.milestone.icon}
        </span>
        <span className="text-foreground">{fi.milestone.name}</span>
        <span className="text-foreground-muted">{fi.reached ? whenLabel(doc, fi.milestone) : "Not reached in this plan"}</span>
        <Badge>{MILESTONE_SOURCE_LABELS[milestoneSource(fi.milestone)]}</Badge>
      </div>
    </div>
  )
}

/** Milestones created by kids and by assets bought or sold; edited where they come from. */
function GeneratedMilestones({ doc }: { doc: PlanDocument }) {
  const { milestones: groupColors } = usePlanColors()
  const payoffs = useMemo(() => payoffMilestones(doc), [doc])
  const marks = [...generatedMilestones(doc), ...payoffs]
  if (marks.length === 0) return null
  return (
    <div className="rounded-xl border border-dashed border-card-border p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">From your kids and assets</p>
      <p className="text-[11px] text-foreground-muted">Edit them where they come from.</p>
      {marks.map((m) => (
        <Link
          key={m.id}
          href={m.kind === "child" ? "?tab=expenses" : "?tab=assets"}
          scroll={false}
          className="flex items-center gap-2 text-xs rounded-md -mx-1 px-1 py-0.5 hover:bg-foreground/5"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 15, color: groupColors[milestoneGroup(m)] }}>
            {m.icon ?? "flag"}
          </span>
          <span className="text-foreground">{m.name}</span>
          <span className="text-foreground-muted">{whenLabel(doc, m)}</span>
          <Badge>{MILESTONE_SOURCE_LABELS[milestoneSource(m)]}</Badge>
          <span className="ml-auto text-[11px] text-primary">Edit on {m.kind === "child" ? "Expenses" : "Assets & debts"} →</span>
        </Link>
      ))}
    </div>
  )
}

/** Named points in time that income, spending and assets can start or stop at. */
export function MilestonesEditor({ doc, update, view, onEditItem, viewToggle }: PlanEditorProps) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { milestones: groupColors } = usePlanColors()
  const patch = (id: string, change: Partial<PlanMilestone>) =>
    update((d) => ({ ...d, milestones: patchItem(d.milestones, id, change) }))

  return (
    <div className="space-y-3">
      <EditorToolbar toggle={viewToggle}>
        <AddButton label="Add milestone" disabled={doc.milestones.length >= PLAN_LIMITS.milestones} onClick={() => setAdding(true)} />
      </EditorToolbar>
      <p className="text-xs text-foreground-muted">
        Your plan&apos;s timeline. Life events that change several things at once are added here; homes, cars, kids and income changes
        are added on their own tabs and show up here too. Move a milestone and everything tied to it moves with it.
      </p>
      {view === "compact" ? (
        <MilestonesTable doc={doc} update={update} onEditItem={onEditItem} onDelete={setDeleting} />
      ) : doc.milestones.map((m) => (
        <ItemCard
          key={m.id} anchorId={planItemAnchor(m.id)}
          title={
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: groupColors[milestoneGroup(m)] }}>
                {m.icon ?? (m.kind === "retirement" ? "beach_access" : "flag")}
              </span>
              {m.name || "Untitled milestone"}
              <span className="text-[11px] font-normal text-foreground-muted">{whenLabel(doc, m)}</span>
            </span>
          }
          removeLabel={`Remove ${m.name}`}
          onRemove={
            m.kind === "retirement"
              ? undefined
              : () => setDeleting(m.id)
          }
        >
          <UsedBy uses={milestoneUses(doc, m.id)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            <TextField label="Name" value={m.name} onChange={(name) => patch(m.id, { name })} />
            <TimingPicker
              label="When"
              value={m.timing}
              doc={{ ...doc, milestones: doc.milestones.filter((x) => x.id !== m.id) }}
              allow={["age", "year", "milestone"]}
              onChange={(timing) => patch(m.id, { timing })}
            />
          </div>
        </ItemCard>
      ))}
      {view !== "compact" && (
        <>
          <FiMilestoneCard doc={doc} />
          <GeneratedMilestones doc={doc} />
        </>
      )}
      {adding && <AddMilestoneDialog doc={doc} update={update} onClose={() => setAdding(false)} />}
      {deleting && <DeleteMilestoneDialog doc={doc} update={update} id={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
