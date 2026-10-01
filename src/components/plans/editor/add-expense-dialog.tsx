"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { patternForNewLine } from "@/lib/plans/plan-spending-patterns"
import type { PlanExpense, Timing } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"

interface ExpenseChoice {
  key: string
  icon: string
  label: string
  detail: string
  name: string
  /** A year's amount (or the whole amount when one-time), today's dollars. */
  amount: number
  oneTime: boolean
}

/** Starting values only; every one is edited in the form. Kids and home or car costs have their own places. */
const CHOICES: ExpenseChoice[] = [
  { key: "living", icon: "shopping_cart", label: "Everyday living", detail: "Groceries, bills, the usual", name: "Living expenses", amount: 40_000, oneTime: false },
  { key: "housing", icon: "apartment", label: "Rent", detail: "Housing you don't own", name: "Rent", amount: 24_000, oneTime: false },
  { key: "travel", icon: "flight", label: "Travel & fun", detail: "Trips, hobbies, going out", name: "Travel", amount: 6_000, oneTime: false },
  { key: "health", icon: "medical_services", label: "Healthcare", detail: "Premiums and out-of-pocket", name: "Healthcare", amount: 6_000, oneTime: false },
  { key: "oneTime", icon: "celebration", label: "One-time cost", detail: "A wedding, renovation, big trip", name: "One-time cost", amount: 25_000, oneTime: true },
  { key: "other", icon: "receipt_long", label: "Something else", detail: "Any other spending line", name: "Expense", amount: 5_000, oneTime: false },
]

function ChoiceGrid({ onPick }: { onPick: (c: ExpenseChoice) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {CHOICES.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onPick(c)}
          className="flex flex-col items-start gap-1 rounded-xl border border-card-border p-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>
            {c.icon}
          </span>
          <span className="text-sm font-medium text-foreground">{c.label}</span>
          <span className="text-[11px] leading-snug text-foreground-muted">{c.detail}</span>
        </button>
      ))}
    </div>
  )
}

/** Pop-out for adding a spending line: pick what it's for, then how much and when. */
export function AddExpenseDialog({ doc, update, onClose }: Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void }) {
  const [choice, setChoice] = useState<ExpenseChoice | null>(null)
  const [line, setLine] = useState<PlanExpense | null>(null)
  const full = doc.expenses.length >= PLAN_LIMITS.expenses
  const set = (change: Partial<PlanExpense>) => setLine((l) => (l ? { ...l, ...change } : l))

  const pick = (c: ExpenseChoice) => {
    const start: Timing = c.oneTime ? { type: "year", year: doc.settings.startYear + 2 } : { type: "planStart" }
    setChoice(c)
    setLine({ id: newItemId("exp"), name: c.name, category: null, amount: c.amount, growth: null, start, end: { type: "planEnd" }, oneTime: c.oneTime })
  }
  const add = () => {
    if (!line || full) return
    update((d) => {
      const named = { ...line, name: line.name.trim() || choice?.name || "Expense" }
      return { ...d, expenses: [...d.expenses, { ...named, pattern: patternForNewLine(d, named) }] }
    })
    toast.success("Added to Expenses")
    onClose()
  }

  return (
    <AccountsModalShell
      title={choice ? `Add ${choice.label.toLowerCase()}` : "Add an expense"}
      onClose={onClose}
      footer={
        choice ? (
          <>
            <button type="button" onClick={() => setChoice(null)} className="btn-ghost text-sm mr-auto">
              ← Back
            </button>
            {full && <span className="self-center text-xs text-foreground-muted">This plan has the most expenses it can hold.</span>}
            <button type="button" onClick={add} disabled={full} className="btn-primary text-sm disabled:opacity-50">
              Add
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        )
      }
    >
      {!choice && <ChoiceGrid onPick={pick} />}
      {choice && line && (
        <div className="space-y-3">
          <TextField label="Name" value={line.name} onChange={(name) => set({ name })} />
          <FireNumberField
            label={line.oneTime ? "Amount (today's $)" : "Per year (today's $)"}
            prefix="$"
            min={0}
            value={line.amount}
            onChange={(amount) => set({ amount })}
          />
          <div className="grid grid-cols-2 gap-2">
            <TimingPicker label={line.oneTime ? "When" : "Starts"} value={line.start} doc={doc} onChange={(start) => set({ start })} />
            {!line.oneTime && <TimingPicker label="Ends" value={line.end} doc={doc} onChange={(end) => set({ end })} />}
          </div>
          <p className="text-xs text-foreground-muted">
            {line.oneTime
              ? "Paid once, in that year, at that year's prices."
              : "Rises with inflation each year. Change how it grows, or shape it over retirement, on its card."}
          </p>
        </div>
      )}
    </AccountsModalShell>
  )
}
