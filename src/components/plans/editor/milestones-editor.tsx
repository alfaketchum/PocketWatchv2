"use client"

import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { generatedMilestones } from "@/lib/plans/plan-milestones"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanDocument, PlanMilestone } from "@/lib/plans/plan-types"
import { newItemId, patchItem, primaryAge, type PlanEditorProps } from "../plans-helpers"
import { AddButton, ItemCard, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

function newMilestone(doc: PlanDocument): PlanMilestone {
  const person = doc.people[0]
  return {
    id: newItemId("ms"),
    name: "Kids leave home",
    kind: "custom",
    timing: { type: "age", personId: person?.id ?? "", age: primaryAge(doc) + 15 },
  }
}

function whenLabel(doc: PlanDocument, milestone: PlanMilestone): string {
  const index = resolveTiming(milestone.timing, timingContext(doc))
  if (index === null) return "Can't be placed (check what it points at)"
  return `${doc.settings.startYear + index} · age ${primaryAge(doc) + index}`
}

/** Milestones created by kids and by assets bought or sold; edited where they come from. */
function GeneratedMilestones({ doc }: { doc: PlanDocument }) {
  const marks = generatedMilestones(doc)
  if (marks.length === 0) return null
  return (
    <div className="rounded-xl border border-dashed border-card-border p-3 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">From your kids and assets</p>
      <p className="text-[11px] text-foreground-muted">
        Created automatically. Change them on the Expenses tab (kids) or the Assets &amp; debts tab (buying or selling).
      </p>
      {marks.map((m) => (
        <div key={m.id} className="flex items-center gap-2 text-xs">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 15 }}>
            {m.icon ?? "flag"}
          </span>
          <span className="text-foreground">{m.name}</span>
          <span className="text-foreground-muted">{whenLabel(doc, m)}</span>
        </div>
      ))}
    </div>
  )
}

/** Named points in time that income, spending and assets can start or stop at. */
export function MilestonesEditor({ doc, update }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanMilestone>) =>
    update((d) => ({ ...d, milestones: patchItem(d.milestones, id, change) }))

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted">
        Point income and spending at a milestone instead of a fixed age, then move the milestone to shift everything at once.
      </p>
      {doc.milestones.map((m) => (
        <ItemCard
          key={m.id}
          title={
            <span>
              {m.name || "Untitled milestone"}
              <span className="ml-2 text-[11px] font-normal text-foreground-muted">{whenLabel(doc, m)}</span>
            </span>
          }
          removeLabel={`Remove ${m.name}`}
          onRemove={
            m.kind === "retirement"
              ? undefined
              : () => update((d) => ({ ...d, milestones: d.milestones.filter((x) => x.id !== m.id) }))
          }
        >
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
      <GeneratedMilestones doc={doc} />
      <AddButton
        label="Add milestone"
        disabled={doc.milestones.length >= PLAN_LIMITS.milestones}
        onClick={() => update((d) => ({ ...d, milestones: [...d.milestones, newMilestone(d)] }))}
      />
    </div>
  )
}
