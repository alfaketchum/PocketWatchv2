"use client"

import { useMemo, useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanExpense } from "@/lib/plans/plan-types"
import { overlapWarning, retirementAge } from "@/lib/plans/plan-spending-patterns"
import { PatternProfileMenu } from "./pattern-profile-menu"
import { patchItem, type PlanEditorProps, planItemAnchor, primaryAge } from "../plans-helpers"
import { ExpensePatternField } from "./expense-pattern-field"
import { GrowthField } from "./growth-field"
import { ChildrenEditor } from "./children-editor"
import { AddButton, EditorToolbar, EmptyNote, ItemCard, SelectField, TextField } from "./plan-editor-controls"
import { useExpenseCategories } from "./use-expense-categories"
import { TimingPicker } from "./timing-picker"
import { AddExpenseDialog, EXPENSE_EVENTS } from "./add-expense-dialog"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import type { TemplateKey } from "@/lib/plans/milestone-templates"
import { ExpensesTable } from "./expenses-table"
import { AssetCostList } from "./asset-cost-list"
import { assetCostLines } from "@/lib/plans/plan-asset-costs"

const NO_CATEGORY = "none"

/** Add a spending line, or a life event whose costs land here (opens the same form as on Milestones). */
function AddExpenseButton({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const [open, setOpen] = useState(false)
  const [event, setEvent] = useState<TemplateKey | null>(null)
  return (
    <>
      <AddButton label="Add expense" disabled={doc.expenses.length >= PLAN_LIMITS.expenses} onClick={() => setOpen(true)} />
      {open && (
        <AddExpenseDialog
          doc={doc}
          update={update}
          onClose={() => setOpen(false)}
          onEvent={(key) => {
            setOpen(false)
            setEvent(key)
          }}
        />
      )}
      {event && (
        <AddMilestoneDialog
          doc={doc}
          update={update}
          initial={event}
          keys={EXPENSE_EVENTS.map((e) => e.key)}
          title="Add a life event"
          onClose={() => setEvent(null)}
        />
      )}
    </>
  )
}

/** Spending streams: everyday living costs, kids, travel, a one-time wedding or car. */
export function ExpensesEditor({ doc, update, view, onEditItem, viewToggle }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanExpense>) =>
    update((d) => ({ ...d, expenses: patchItem(d.expenses, id, change) }))
  const recurringTotal = useMemo(
    () => doc.expenses.filter((e) => !e.oneTime && e.start.type === "planStart").reduce((s, e) => s + e.amount, 0),
    [doc.expenses],
  )
  const ages = useMemo(() => ({ from: primaryAge(doc), to: doc.settings.endAge, retire: retirementAge(doc) }), [doc])
  const categories = useExpenseCategories()
  // Your categories, keeping a line's own category listed even if it's no longer one of them.
  const categoryOptions = (current: string | null) => [
    { value: NO_CATEGORY, label: "None" },
    ...categories.map((c) => ({ value: c.label, label: c.label })),
    ...(current && !categories.some((c) => c.label === current) ? [{ value: current, label: current }] : []),
  ]


  return (
    <div className="space-y-8">
      <EditorToolbar toggle={viewToggle}>
        <AddExpenseButton doc={doc} update={update} />
      </EditorToolbar>
      <ChildrenEditor doc={doc} update={update} view={view} />
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Other expenses</p>
        {doc.expenses.length === 0 ? (
          <EmptyNote>No expenses yet. Start with one line for everyday living costs; split it up later if you want.</EmptyNote>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-foreground-muted">
              Spending today: <span className="font-semibold text-foreground tabular-nums">{fmtMoney(recurringTotal)}</span> / yr
            </p>
            <PatternProfileMenu doc={doc} update={update} />
          </div>
        )}
        {view === "compact" ? (
        <ExpensesTable doc={doc} update={update} onEditItem={onEditItem} />
      ) : doc.expenses.map((e) => (
          <ItemCard
            key={e.id} anchorId={planItemAnchor(e.id)}
            title={e.name || "Untitled expense"}
            removeLabel={`Remove ${e.name}`}
            onRemove={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }))}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
              <div className="col-span-2 lg:col-span-1">
                <TextField label="Name" value={e.name} onChange={(name) => patch(e.id, { name })} />
              </div>
              {!e.oneTime && (
                <FireNumberField label="Per month (today's $)" prefix="$" min={0} value={e.amount / 12} onChange={(monthly) => patch(e.id, { amount: monthly * 12 })} />
              )}
              <FireNumberField
                label={e.oneTime ? "Amount (today's $)" : "Per year (today's $)"}
                prefix="$"
                min={0}
                value={e.amount}
                onChange={(amount) => patch(e.id, { amount })}
              />
              <GrowthField value={e.growth} inflation={doc.settings.inflation} onChange={(growth) => patch(e.id, { growth })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <SelectField
                label="Category"
                value={e.category ?? NO_CATEGORY}
                options={categoryOptions(e.category)}
                onChange={(v) => patch(e.id, { category: v === NO_CATEGORY ? null : v })}
              />
              <TimingPicker
                label={e.oneTime ? "When" : "Starts"}
                value={e.start}
                doc={doc}
                onChange={(start) => patch(e.id, { start })}
              />
              {!e.oneTime && (
                <TimingPicker
                  label="Stops"
                  value={e.end}
                  doc={doc}
                  allow={["planEnd", "age", "year", "milestone"]}
                  onChange={(end) => patch(e.id, { end })}
                />
              )}
            </div>
            <Toggle label="One-time" checked={e.oneTime} onChange={(oneTime) => patch(e.id, { oneTime })} />
            {!e.oneTime && (
              <ExpensePatternField
                pattern={e.pattern}
                onChange={(pattern) => patch(e.id, { pattern })}
                fromAge={ages.from}
                toAge={ages.to}
                retireAge={ages.retire}
                warning={overlapWarning(e, doc.settings.inflation)}
              />
            )}
          </ItemCard>
        ))}
        {view !== "compact" && <AssetCostList lines={assetCostLines(doc)} />}
      </div>
    </div>
  )
}
