"use client"

import { useEffect, useMemo, useState } from "react"
import { AccountsModalShell, INPUT_CLASS, ModalField } from "@/components/accounts/accounts-modal-shell"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { usePlanImportPreview } from "@/hooks/plans/use-plan-import"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { SpendingBasis } from "@/lib/plans/import/import-mapping"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { cn } from "@/lib/utils"

const SPENDING_CHOICES: { value: SpendingBasis; label: string; detail: string }[] = [
  { value: "average", label: "Recent spending", detail: "Your 12-month average per category" },
  { value: "median", label: "Typical month", detail: "Each category's median month, so one-off big months don't count double" },
  { value: "budget", label: "My budgets", detail: "Your budget where you set one; recent spending for the rest" },
]

const SPENDING_TITLE = "Spending (per year)"

const SPENDING_DETAIL: Record<SpendingBasis, string> = {
  average: "12-month average",
  median: "typical month",
  budget: "your budget",
}

function SpendingChoice({ value, onChange, hasBudgets }: { value: SpendingBasis; onChange: (v: SpendingBasis) => void; hasBudgets: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Spending based on</p>
      <div role="radiogroup" aria-label="Spending based on" className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {SPENDING_CHOICES.map((c) => {
          const disabled = c.value === "budget" && !hasBudgets
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={value === c.value}
              disabled={disabled}
              onClick={() => onChange(c.value)}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-40",
                value === c.value ? "border-primary bg-primary/5" : "border-card-border hover:border-primary/50",
              )}
            >
              <span className="block text-xs font-medium text-foreground">{c.label}</span>
              <span className="block text-[10px] leading-snug text-foreground-muted">{disabled ? "No budgets set yet (Budgets page)" : c.detail}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface Row {
  id: string
  label: string
  detail: string
  amount: number
}

function groupsFor(doc: PlanDocument, spendingDetail: (category: string | null) => string): { title: string; rows: Row[] }[] {
  return [
    {
      title: "Accounts",
      rows: doc.accounts.map((a) => ({ id: a.id, label: a.name, detail: TAX_TREATMENT_LABELS[a.taxTreatment], amount: a.balance })),
    },
    {
      title: "Homes & vehicles",
      rows: doc.assets.map((a) => ({ id: a.id, label: a.name, detail: "owned now", amount: a.value })),
    },
    {
      title: "Debts",
      rows: doc.debts.map((d) => ({ id: d.id, label: d.name, detail: `${fmtMoney(d.monthlyPayment)}/mo`, amount: -d.balance })),
    },
    {
      title: "Income (per year)",
      rows: doc.incomes.map((i) => ({ id: i.id, label: i.name, detail: "until retirement", amount: i.amount })),
    },
    {
      title: SPENDING_TITLE,
      rows: doc.expenses.map((e) => ({ id: e.id, label: e.name, detail: spendingDetail(e.category), amount: -e.amount })),
    },
  ].filter((g) => g.rows.length > 0 || g.title === SPENDING_TITLE)
}

/** Drop the unticked items. */
function pick(doc: PlanDocument, unticked: Set<string>): PlanDocument {
  const kept = (id: string) => !unticked.has(id)
  return {
    ...doc,
    accounts: doc.accounts.filter((a) => kept(a.id)),
    assets: doc.assets.filter((a) => kept(a.id)),
    // A loan kept without its home or car no longer points at it.
    debts: doc.debts
      .filter((d) => kept(d.id))
      .map((d) => (d.assetId && !kept(d.assetId) ? { ...d, assetId: null } : d)),
    incomes: doc.incomes.filter((i) => kept(i.id)),
    expenses: doc.expenses.filter((e) => kept(e.id)),
  }
}

interface Props {
  initialName: string
  isPending: boolean
  onCreate: (name: string, document: PlanDocument) => void
  onClose: () => void
}

/** Preview what "Start from my data" pulls in, untick anything, then create the plan. */
export function ImportPreviewDialog({ initialName, isPending, onCreate, onClose }: Props) {
  const preview = usePlanImportPreview(true)
  const [name, setName] = useState(initialName)
  // Track what's unticked, so switching how spending is measured keeps choices and ticks new lines.
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const [basis, setBasis] = useState<SpendingBasis>("average")
  const data = preview.data
  const doc = useMemo(() => (data ? { ...data.document, expenses: data.spending[basis] } : null), [data, basis])
  const groups = useMemo(() => {
    if (!doc || !data) return []
    const budgeted = new Set(data.budgetedCategories)
    const detail = (category: string | null) =>
      basis === "budget" && !(category && budgeted.has(category)) ? "recent average (no budget)" : SPENDING_DETAIL[basis]
    return groupsFor(doc, detail)
  }, [doc, data, basis])

  useEffect(() => {
    if (data) setUnticked(new Set(data.uncheckedIds))
  }, [data])

  const toggle = (id: string) =>
    setUnticked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const canCreate = !!doc && name.trim().length > 0 && !isPending
  return (
    <AccountsModalShell
      title="Start from my data"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => doc && onCreate(name.trim(), pick(doc, unticked))}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create plan"}
          </button>
        </>
      }
    >
      <ModalField label="Plan name" htmlFor="import-plan-name">
        <input id="import-plan-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
      </ModalField>
      <p className="text-xs text-foreground-muted">
        A one-time copy of today&apos;s balances, income and spending. After this the plan is yours to edit; it won&apos;t change on
        its own.
      </p>
      {preview.isLoading && <div className="h-40 animate-shimmer rounded-xl" />}
      {preview.error && <p className="text-xs text-error">Couldn&apos;t read your data: {preview.error.message}</p>}
      {groups.map((g) => (
        <div key={g.title} className="space-y-1">
          {g.title === SPENDING_TITLE && data && (
            <SpendingChoice value={basis} onChange={setBasis} hasBudgets={data.budgetedCategories.length > 0} />
          )}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{g.title}</p>
          {g.rows.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-row-hover cursor-pointer md:min-h-0 md:gap-2 md:py-1">
              <input type="checkbox" checked={!unticked.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 shrink-0 accent-[var(--primary)] md:h-auto md:w-auto" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{r.label}</span>
                <span className="block text-[10px] text-foreground-muted">{r.detail}</span>
              </span>
              <span className={`shrink-0 text-xs tabular-nums ${r.amount < 0 ? "text-error" : "text-foreground"}`}>{fmtMoney(r.amount)}</span>
            </label>
          ))}
        </div>
      ))}
      {doc && groups.length === 0 && <p className="text-xs text-foreground-muted">No linked data found. Start with a blank plan instead.</p>}
    </AccountsModalShell>
  )
}
