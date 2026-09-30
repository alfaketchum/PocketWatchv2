"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { PLAN_LIMITS, RETIREMENT_MILESTONE_ID } from "@/lib/plans/plan-constants"
import type { IncomeKind, PlanIncome, Timing } from "@/lib/plans/plan-types"
import { newItemId, patchItem, type PlanEditorProps, planItemAnchor } from "../plans-helpers"
import { DepositsEditor } from "./deposits-editor"
import { GrowthField } from "./growth-field"
import { IncomeContributionsEditor } from "./income-contributions-editor"
import { AddButton, EditorToolbar, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { IncomesTable } from "./incomes-table"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import type { TemplateKey } from "@/lib/plans/milestone-templates"

const KIND_OPTIONS: { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "business", label: "Business" },
  { value: "social_security", label: "Social Security" },
  { value: "pension", label: "Pension" },
  { value: "rental", label: "Rental" },
  { value: "other", label: "Other" },
]

/** Income types that usually come with a workplace plan. */
const PAYROLL_KINDS = new Set<IncomeKind>(["salary", "business"])

/** Income changes offered from Add income (they also add a milestone to the timeline). */
const INCOME_TEMPLATES: TemplateKey[] = ["career", "break", "windfall"]

function newIncome(hasRetirement: boolean): PlanIncome {
  const end: Timing = hasRetirement ? { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID } : { type: "planEnd" }
  return {
    id: newItemId("inc"),
    name: "Salary",
    kind: "salary",
    amount: 80_000,
    growth: null,
    start: { type: "planStart" },
    end,
    taxable: true,
    oneTime: false,
    contributions: [],
  }
}

/** Income streams: salary until retirement, Social Security later, one-time windfalls. */
export function IncomesEditor({ doc, update, view, onEditItem, viewToggle }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanIncome>) =>
    update((d) => ({ ...d, incomes: patchItem(d.incomes, id, change) }))
  const hasRetirement = doc.milestones.some((m) => m.id === RETIREMENT_MILESTONE_ID)
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-3">
      <EditorToolbar toggle={viewToggle}>
        <AddButton label="Add income" disabled={doc.incomes.length >= PLAN_LIMITS.incomes} onClick={() => setAdding(true)} />
      </EditorToolbar>
      {doc.incomes.length === 0 && <EmptyNote>No income yet. Add your salary, and later Social Security or a pension.</EmptyNote>}
      {view === "compact" ? (
        <IncomesTable doc={doc} update={update} onEditItem={onEditItem} />
      ) : doc.incomes.map((inc) => (
        <ItemCard
          key={inc.id} anchorId={planItemAnchor(inc.id)}
          title={inc.name || "Untitled income"}
          removeLabel={`Remove ${inc.name}`}
          onRemove={() => update((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== inc.id) }))}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 lg:col-span-1">
              <TextField label="Name" value={inc.name} onChange={(name) => patch(inc.id, { name })} />
            </div>
            <SelectField label="Type" value={inc.kind} options={KIND_OPTIONS} onChange={(kind) => patch(inc.id, { kind })} />
            <FireNumberField
              label={inc.oneTime ? "Amount (today's $)" : "Per year (today's $)"}
              prefix="$"
              min={0}
              value={inc.amount}
              onChange={(amount) => patch(inc.id, { amount })}
            />
            <GrowthField value={inc.growth} inflation={doc.settings.inflation} onChange={(growth) => patch(inc.id, { growth })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TimingPicker label={inc.oneTime ? "When" : "Starts"} value={inc.start} doc={doc} onChange={(start) => patch(inc.id, { start })} />
            {!inc.oneTime && (
              <TimingPicker
                label="Stops"
                value={inc.end}
                doc={doc}
                allow={["planEnd", "age", "year", "milestone"]}
                onChange={(end) => patch(inc.id, { end })}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle label="Taxable" checked={inc.taxable} onChange={(taxable) => patch(inc.id, { taxable })} />
            <Toggle label="One-time" checked={inc.oneTime} onChange={(oneTime) => patch(inc.id, { oneTime })} />
          </div>
          {!inc.oneTime && (PAYROLL_KINDS.has(inc.kind) || inc.contributions.length > 0) && (
            <IncomeContributionsEditor
              contributions={inc.contributions}
              accounts={doc.accounts}
              onChange={(contributions) => patch(inc.id, { contributions })}
            />
          )}
        </ItemCard>
      ))}
      {adding && (
        <AddMilestoneDialog
          doc={doc}
          update={update}
          title="Add income"
          keys={INCOME_TEMPLATES}
          instant={[
            {
              label: "Salary or other income",
              icon: "payments",
              detail: "A regular income you set up yourself",
              onPick: () => {
                update((d) => ({ ...d, incomes: [...d.incomes, newIncome(hasRetirement)] }))
                setAdding(false)
              },
            },
          ]}
          onClose={() => setAdding(false)}
        />
      )}
      <DepositsEditor doc={doc} update={update} />
    </div>
  )
}
