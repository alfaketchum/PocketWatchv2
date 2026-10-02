"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { cn } from "@/lib/utils"
import { PLAN_LIMITS } from "@/lib/plans/plan-constants"
import { patternForNewLine } from "@/lib/plans/plan-spending-patterns"
import { MILESTONE_TEMPLATES, type TemplateKey } from "@/lib/plans/milestone-templates"
import { eventsFor, useOfferedTemplates } from "./add-milestone-dialog"
import type { PlanExpense, Timing } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"
import { TextField } from "./plan-editor-controls"
import { TimingPicker } from "./timing-picker"
import { useExpenseCategories, type ExpenseCategory } from "./use-expense-categories"

const MONTHS = 12
/** A year's amount when Finance has no spending for the category. */
const DEFAULT_YEARLY = 6_000
const OTHER: ExpenseCategory = { label: "Something else", icon: "receipt_long", hex: "", avgMonthly: null, medianMonthly: null, budgetMonthly: null }

/** What's already planned in a category: its recurring lines and their yearly total. */
interface Planned {
  lines: PlanExpense[]
  yearly: number
}

function plannedByCategory(expenses: PlanExpense[]): Map<string, Planned> {
  const out = new Map<string, Planned>()
  for (const e of expenses) {
    if (!e.category || e.oneTime) continue
    const cur = out.get(e.category) ?? { lines: [], yearly: 0 }
    out.set(e.category, { lines: [...cur.lines, e], yearly: cur.yearly + e.amount })
  }
  return out
}

/** A category tile: already in the plan (neutral check, click edits it), spent on but missing (amber note), or plain. */
function CategoryTile({ c, planned, onPick }: { c: ExpenseCategory; planned: Planned | undefined; onPick: () => void }) {
  const gap = !planned && c.avgMonthly !== null && c.avgMonthly > 0
  const status = planned
    ? `In plan: ${fmtMoney(planned.yearly / MONTHS)}/mo${planned.lines.length > 1 ? ` (${planned.lines.length} lines)` : ""}`
    : gap
      ? `You spend ${fmtMoney(c.avgMonthly)}/mo · not in plan`
      : null
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={planned ? `${c.label}: ${status}. Edit it` : status ? `${c.label}: ${status}` : c.label}
      className={cn(
        "relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5",
        gap ? "border-warning/40" : "border-card-border",
      )}
    >
      {planned && (
        <span className="material-symbols-rounded absolute right-1.5 top-1.5 text-foreground-muted" style={{ fontSize: 14 }} aria-hidden="true">
          check_circle
        </span>
      )}
      <span className="material-symbols-rounded shrink-0" style={{ fontSize: 20, color: c.hex || "var(--primary)" }} aria-hidden="true">
        {c.icon}
      </span>
      <span className="min-w-0 pr-3">
        <span className="block truncate text-sm font-medium text-foreground">{c.label}</span>
        {status && <span className={cn("block text-[11px] leading-snug tabular-nums", gap ? "text-warning" : "text-foreground-muted")}>{status}</span>}
      </span>
    </button>
  )
}

function CategoryGrid({
  categories,
  planned,
  onPick,
}: {
  categories: ExpenseCategory[]
  planned: Map<string, Planned>
  onPick: (c: ExpenseCategory | null) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[...categories, OTHER].map((c) => (
        <CategoryTile key={c.label} c={c} planned={c === OTHER ? undefined : planned.get(c.label)} onPick={() => onPick(c === OTHER ? null : c)} />
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

/** Life events whose costs land on Expenses; they open the same event form as on Milestones. */
const EVENT_DETAILS: Partial<Record<TemplateKey, string>> = { child: "Raising costs, college, a 529", elderCare: "Care for a parent, and who pays" }
export const EXPENSE_EVENTS = eventsFor("Expenses").map((key) => {
  const meta = MILESTONE_TEMPLATES.find((t) => t.key === key)!
  return { key, label: meta.label, icon: meta.icon, detail: EVENT_DETAILS[key] ?? meta.creates }
})

function EventChoices({ onEvent }: { onEvent: (key: TemplateKey) => void }) {
  const offered = useOfferedTemplates()(EXPENSE_EVENTS.map((e) => e.key))
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">Life events</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {EXPENSE_EVENTS.filter((e) => offered.includes(e.key)).map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => onEvent(e.key)}
            className="flex items-center gap-2 rounded-xl border border-card-border px-3 py-2.5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-rounded shrink-0 text-primary" style={{ fontSize: 20 }}>
              {e.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{e.label}</span>
              <span className="block truncate text-[11px] text-foreground-muted">{e.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Pop-out for adding a spending line in one of your budget categories, or a life event whose costs land here. */
export function AddExpenseDialog({
  doc,
  update,
  onClose,
  onEvent,
}: Pick<PlanEditorProps, "doc" | "update"> & { onClose: () => void; onEvent: (key: TemplateKey) => void }) {
  const categories = useExpenseCategories()
  const planned = useMemo(() => plannedByCategory(doc.expenses), [doc.expenses])
  const [picked, setPicked] = useState<ExpenseCategory | null | undefined>(undefined)
  const [line, setLine] = useState<PlanExpense | null>(null)
  /** The existing line being edited, when a category already in the plan was picked. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const full = doc.expenses.length >= PLAN_LIMITS.expenses
  const set = (change: Partial<PlanExpense>) => setLine((l) => (l ? { ...l, ...change } : l))

  /** A fresh line in the category (or a blank one), pre-filled with your average. */
  const startNew = (c: ExpenseCategory | null) => {
    setEditingId(null)
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
  // Picking a category that's already planned opens that line: edit rather than add a duplicate by accident.
  const pick = (c: ExpenseCategory | null) => {
    setPicked(c)
    const existing = c ? planned.get(c.label)?.lines[0] : undefined
    if (!existing) return startNew(c)
    setEditingId(existing.id)
    setLine(existing)
  }
  const setOneTime = (oneTime: boolean) => {
    const start: Timing = oneTime ? { type: "year", year: doc.settings.startYear + 2 } : { type: "planStart" }
    set({ oneTime, start })
  }
  const save = () => {
    if (!line) return
    if (editingId) {
      update((d) => ({ ...d, expenses: d.expenses.map((e) => (e.id === editingId ? { ...line, name: line.name.trim() || e.name } : e)) }))
      toast.success(`Saved ${line.name.trim() || "the expense"}`)
      onClose()
      return
    }
    if (full) return
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
      title={chosen ? `${editingId ? "Edit" : "Add"} ${(line.category ?? (editingId ? "expense" : "an expense")).toLowerCase()}` : "Add an expense"}
      onClose={onClose}
      footer={
        chosen ? (
          <>
            <button type="button" onClick={() => setPicked(undefined)} className="btn-ghost text-sm mr-auto">
              ← Back
            </button>
            {full && !editingId && <span className="self-center text-xs text-foreground-muted">This plan has the most expenses it can hold.</span>}
            <button type="button" onClick={save} disabled={full && !editingId} className="btn-primary text-sm disabled:opacity-50">
              {editingId ? "Save" : "Add"}
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
          <p className="text-xs text-foreground-muted">
            Your budget categories. A check means it&apos;s already in your plan (click to edit it); an amber note means you spend on it
            but it isn&apos;t planned yet. Averages are your last 12 months, as &ldquo;Start from my data&rdquo; measures them.
          </p>
          <CategoryGrid categories={categories} planned={planned} onPick={pick} />
          <EventChoices onEvent={onEvent} />
        </>
      )}
      {chosen && (
        <div className="space-y-3">
          {editingId && (
            <p className="text-xs text-foreground-muted">
              {line.category} is already in your plan; you&apos;re editing that line.{" "}
              {!full && (
                <button type="button" onClick={() => startNew(picked ?? null)} className="text-primary hover:underline">
                  Add a separate {line.category} line instead
                </button>
              )}
            </p>
          )}
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
