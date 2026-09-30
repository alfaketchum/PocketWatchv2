"use client"

import { useMemo } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import type { PlanExpense } from "@/lib/plans/plan-types"
import { overlapWarning, retirementAge } from "@/lib/plans/plan-spending-patterns"
import { PatternProfileMenu } from "./pattern-profile-menu"
import { newItemId, patchItem, type PlanEditorProps, planItemAnchor, primaryAge } from "../plans-helpers"
import { ExpensePatternField } from "./expense-pattern-field"
import { GrowthField } from "./growth-field"
import { ChildrenEditor } from "./children-editor"
import { AddButton, EmptyNote, ItemCard, TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { ExpensesTable } from "./expenses-table"

function newExpense(): PlanExpense {
  return {
    id: newItemId("exp"),
    name: "Living expenses",
    category: null,
    amount: 40_000,
    growth: null,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    oneTime: false,
  }
}

/** Spending streams: everyday living costs, kids, travel, a one-time wedding or car. */
export function ExpensesEditor({ doc, update, view, onEditItem }: PlanEditorProps) {
  const patch = (id: string, change: Partial<PlanExpense>) =>
    update((d) => ({ ...d, expenses: patchItem(d.expenses, id, change) }))
  const recurringTotal = useMemo(
    () => doc.expenses.filter((e) => !e.oneTime && e.start.type === "planStart").reduce((s, e) => s + e.amount, 0),
    [doc.expenses],
  )
  const ages = useMemo(() => ({ from: primaryAge(doc), to: doc.settings.endAge, retire: retirementAge(doc) }), [doc])


  return (
    <div className="space-y-8">
      {view === "compact" ? (
        <p className="text-xs text-foreground-muted">
          Kids&apos; costs are listed below as read-only lines.{" "}
          <button type="button" onClick={() => onEditItem?.(planItemAnchor("kids"))} className="text-primary hover:underline">
            Add or change kids in Detailed view
          </button>
        </p>
      ) : (
        <ChildrenEditor doc={doc} update={update} />
      )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <AddButton
          label="Add expense"
          disabled={doc.expenses.length >= PLAN_LIMITS.expenses}
          onClick={() => update((d) => ({ ...d, expenses: [...d.expenses, newExpense()] }))}
        />
      </div>
    </div>
  )
}
