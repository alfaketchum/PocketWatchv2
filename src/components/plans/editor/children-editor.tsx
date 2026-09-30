"use client"

import { InputBlock } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { childMilestones, newChild, supportStartAge } from "@/lib/plans/plan-children"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanChild, PlanDocument, Timing } from "@/lib/plans/plan-types"
import { removeChild } from "@/lib/plans/plan-edits"
import { newItemId, patchItem, planItemAnchor, type PlanEditorProps } from "../plans-helpers"
import { Child529Fields, ChildCollegeFields } from "./child-college-fields"
import { ChildSection } from "./child-section"
import { AddButton, ItemCard, TextField } from "./plan-editor-controls"

function milestoneYear(timing: Timing): number | null {
  return timing.type === "year" ? timing.year : null
}

/** "Adds milestones: Sam born (2028) · Sam starts college (2046) …" */
function MilestoneLine({ doc, child }: { doc: PlanDocument; child: PlanChild }) {
  const marks = childMilestones({ ...doc, children: [child] })
  return (
    <p className="text-[11px] text-foreground-muted">
      <span className="material-symbols-rounded align-middle mr-1" style={{ fontSize: 13 }}>
        flag
      </span>
      Adds milestones: {marks.map((m) => `${m.name} (${milestoneYear(m.timing)})`).join(" · ")}. Other items can start or stop at
      them.
    </p>
  )
}

function ChildCard({ child, doc, update }: { child: PlanChild } & PlanEditorProps) {
  const patch = (change: Partial<PlanChild>) => update((d) => ({ ...d, children: patchItem(d.children, child.id, change) }))
  const supportFrom = child.birthYear + supportStartAge(child)
  return (
    <ItemCard
      anchorId={planItemAnchor(child.id)}
      title={`${child.name || "Child"} · born ${child.birthYear}`}
      removeLabel={`Remove ${child.name}`}
      onRemove={() => update((d) => removeChild(d, child.id))}
    >
      <div className="grid grid-cols-2 gap-2 items-end">
        <TextField label="Name" value={child.name} maxLength={40} onChange={(name) => patch({ name })} />
        <FireNumberField
          label="Birth year (past or future)"
          min={1900}
          max={2200}
          value={child.birthYear}
          onChange={(birthYear) => patch({ birthYear })}
        />
      </div>
      <MilestoneLine doc={doc} child={child} />
      <ChildSection
        title="Raising costs"
        description={`Food, clothing, childcare and the rest, from birth until age ${child.raising.untilAge}. Grows with inflation.`}
        enabled={child.raising.enabled}
        onToggle={(enabled) => patch({ raising: { ...child.raising, enabled } })}
      >
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField
            label="Per year (today's $)"
            prefix="$"
            min={0}
            value={child.raising.annualCost}
            hint="The USDA estimate is about $18k a year."
            onChange={(annualCost) => patch({ raising: { ...child.raising, annualCost } })}
          />
          <FireNumberField
            label="Until age"
            min={1}
            max={30}
            value={child.raising.untilAge}
            onChange={(untilAge) => patch({ raising: { ...child.raising, untilAge } })}
          />
        </div>
      </ChildSection>
      <ChildCollegeFields child={child} patch={patch} />
      <Child529Fields child={child} doc={doc} patch={patch} update={update} />
      <ChildSection
        title="Support after college"
        description={`Help beyond ${child.college.enabled ? "college" : "childhood"}: rent, a car, a first apartment. Starts in ${supportFrom}.`}
        enabled={child.support.enabled}
        onToggle={(enabled) => patch({ support: { ...child.support, enabled } })}
      >
        <div className="grid grid-cols-2 gap-2">
          <FireNumberField
            label="Per year (today's $)"
            prefix="$"
            min={0}
            value={child.support.annualAmount}
            onChange={(annualAmount) => patch({ support: { ...child.support, annualAmount } })}
          />
          <FireNumberField
            label="For how many years"
            min={1}
            max={40}
            value={child.support.years}
            onChange={(years) => patch({ support: { ...child.support, years } })}
          />
        </div>
      </ChildSection>
    </ItemCard>
  )
}

/** Kids: each one brings raising costs, optional college, a 529 and support, plus milestones. */
export function ChildrenEditor({ doc, update }: PlanEditorProps) {
  const children = doc.children ?? []
  const add = () =>
    update((d) => ({
      ...d,
      children: [
        ...(d.children ?? []),
        newChild(
          newItemId("kid"),
          children.length === 0 ? "First child" : `Child ${children.length + 1}`,
          d.settings.startYear + 1,
        ),
      ],
    }))
  return (
    <div id={planItemAnchor("kids")} className="scroll-mt-24">
    <InputBlock
      title="Kids"
      description="Add a child (born or planned) to project raising costs, college, a 529 plan and support after college. Each shows up as its own expense lines and milestones."
    >
      {children.map((c) => (
        <ChildCard key={c.id} child={c} doc={doc} update={update} />
      ))}
      <AddButton label="Add a child" disabled={children.length >= PLAN_LIMITS.children} onClick={add} />
    </InputBlock>
    </div>
  )
}
