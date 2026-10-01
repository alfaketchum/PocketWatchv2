"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { cn } from "@/lib/utils"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { patternForNewLine } from "@/lib/plans/plan-spending-patterns"
import type { PlanExpense, Timing } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { useExpenseCategories, type ExpenseCategory } from "./use-expense-categories"

const MONTHS = 12
/** A year's amount when Finance has no spending for the category. */
const DEFAULT_YEARLY = 6_000
const OTHER: ExpenseCategory = { label: "Something else", icon: "receipt_long", hex: "", avgMonthly: null, medianMonthly: null, budgetMonthly: null }

function CategoryGrid({ categories, onPick }: { categories: ExpenseCategory[]; onPick: (c: ExpenseCategory | null) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[...categories, OTHER].map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c === OTHER ? null : c)}
          className="flex items-center gap-2 rounded-xl border border-card-border px-3 py-2.5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-rounded shrink-0" style={{ fontSize: 20, color: c.hex || "var(--primary)" }}>
            {c.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{c.label}</span>
            {c.avgMonthly !== null && <span className="block text-[11px] text-foreground-muted tabular-nums">{fmtMoney(c.avgMonthly)}/mo avg</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Your own numbers for the category, measured as "Start from my data" does: one tap sets the amount. */
function MeasureChips({ category, amount, onPick }: { category: ExpenseCategory; amount: number; onPick: (yearly: number) => void }) {
  const measures = [
    { label: "12-month average", monthly: category.avgMonthly },
    { label: "Median month", monthly: category.medianMonthly },
    { label: "Your budget", monthly: category.budgetMonthly },
  ].filter((m): m is { label: string; monthly: number } => m.monthly !== null && m.monthly > 0)
  if (measures.length === 0) return <p className="text-[11px] text-foreground-muted">No spending in {category.label} in Finance yet.</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {measures.map((m) => {
        const yearly = Math.round(m.monthly * MONTHS)
        return (
          <button
            key={m.label}
            type="button"
            onClick={() => onPick(yearly)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
              Math.round(amount) === yearly ? "border-primary bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground",
            )}
          >
            {m.label}: <span className="tabular-nums">{fmtMoney(m.monthly)}/mo</span>
          </button>
        )
      })}
    </div>
  )
}

/** Pop-out for adding a spending line in one of your budget categories: how much, and when. */
export function AddExpenseDialog({ doc, update, onClose }: Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void }) {
  const categories = useExpenseCategories()
  const [picked, setPicked] = useState<ExpenseCategory | null | undefined>(undefined)
  const [line, setLine] = useState<PlanExpense | null>(null)
  const full = doc.expenses.length >= PLAN_LIMITS.expenses
  const set = (change: Partial<PlanExpense>) => setLine((l) => (l ? { ...l, ...change } : l))

  const pick = (c: ExpenseCategory | null) => {
    setPicked(c)
    setLine({
      id: newItemId("exp"),
      name: c?.label ?? "Expense",
      category: c?.label ?? null,
      amount: c?.avgMonthly ? Math.round(c.avgMonthly * MONTHS) : DEFAULT_YEARLY,
      growth: null,
      start: { type: "planStart" },
      end: { type: "planEnd" },
      oneTime: false,
    })
  }
  const setOneTime = (oneTime: boolean) => {
    const start: Timing = oneTime ? { type: "year", year: doc.settings.startYear + 2 } : { type: "planStart" }
    set({ oneTime, start })
  }
  const add = () => {
    if (!line || full) return
    update((d) => {
      const named = { ...line, name: line.name.trim() || line.category || "Expense" }
      return { ...d, expenses: [...d.expenses, { ...named, pattern: patternForNewLine(d, named) }] }
    })
    toast.success("Added to Expenses")
    onClose()
  }
  const chosen = picked !== undefined && line

  return (
    <AccountsModalShell
      wide={!chosen}
      title={chosen ? `Add ${(line.category ?? "an expense").toLowerCase()}` : "Add an expense"}
      onClose={onClose}
      footer={
        chosen ? (
          <>
            <button type="button" onClick={() => setPicked(undefined)} className="btn-ghost text-sm mr-auto">
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
      {!chosen && (
        <>
          <p className="text-xs text-foreground-muted">Your budget categories, with your average month over the last year (the same numbers &ldquo;Start from my data&rdquo; uses).</p>
          <CategoryGrid categories={categories} onPick={pick} />
        </>
      )}
      {chosen && (
        <div className="space-y-3">
          <TextField label="Name" value={line.name} onChange={(name) => set({ name })} />
          <div className="grid grid-cols-2 gap-2">
            {!line.oneTime && (
              <FireNumberField label="Per month (today's $)" prefix="$" min={0} value={line.amount / MONTHS} onChange={(m) => set({ amount: m * MONTHS })} />
            )}
            <FireNumberField label={line.oneTime ? "Amount (today's $)" : "Per year (today's $)"} prefix="$" min={0} value={line.amount} onChange={(amount) => set({ amount })} />
          </div>
          {picked && !line.oneTime && <MeasureChips category={picked} amount={line.amount} onPick={(amount) => set({ amount })} />}
          <Toggle label="One-time" checked={line.oneTime} onChange={setOneTime} />
          <div className="grid grid-cols-2 gap-2">
            <TimingPicker label={line.oneTime ? "When" : "Starts"} value={line.start} doc={doc} onChange={(start) => set({ start })} />
            {!line.oneTime && <TimingPicker label="Stops" value={line.end} doc={doc} onChange={(end) => set({ end })} />}
          </div>
          <p className="text-xs text-foreground-muted">
            {line.oneTime ? "Paid once, in that year, at that year's prices." : "Rises with inflation each year. Change how it grows, or shape it over retirement, on its card."}
          </p>
        </div>
      )}
    </AccountsModalShell>
  )
}
