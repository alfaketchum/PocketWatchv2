"use client"

import { useEffect, useMemo, useState } from "react"
import { AccountsModalShell, INPUT_CLASS, ModalField } from "@/components/accounts/accounts-modal-shell"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { usePlanImportPreview } from "@/hooks/plans/use-plan-import"
import { TAX_TREATMENT_LABELS } from "@/lib/plans/plan-constants"
import type { PlanDocument } from "@/lib/plans/plan-types"

interface Row {
  id: string
  label: string
  detail: string
  amount: number
}

function groupsFor(doc: PlanDocument): { title: string; rows: Row[] }[] {
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
      title: "Spending (per year)",
      rows: doc.expenses.map((e) => ({ id: e.id, label: e.name, detail: "average of recent months", amount: -e.amount })),
    },
  ].filter((g) => g.rows.length > 0)
}

/** Keep only the ticked items. */
function pick(doc: PlanDocument, selected: Set<string>): PlanDocument {
  return {
    ...doc,
    accounts: doc.accounts.filter((a) => selected.has(a.id)),
    assets: doc.assets.filter((a) => selected.has(a.id)),
    // A loan kept without its home or car no longer points at it.
    debts: doc.debts
      .filter((d) => selected.has(d.id))
      .map((d) => (d.assetId && !selected.has(d.assetId) ? { ...d, assetId: null } : d)),
    incomes: doc.incomes.filter((i) => selected.has(i.id)),
    expenses: doc.expenses.filter((e) => selected.has(e.id)),
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const doc = preview.data?.document ?? null
  const groups = useMemo(() => (doc ? groupsFor(doc) : []), [doc])

  useEffect(() => {
    if (!preview.data) return
    const unchecked = new Set(preview.data.uncheckedIds)
    setSelected(new Set(groupsFor(preview.data.document).flatMap((g) => g.rows.map((r) => r.id)).filter((id) => !unchecked.has(id))))
  }, [preview.data])

  const toggle = (id: string) =>
    setSelected((prev) => {
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
            onClick={() => doc && onCreate(name.trim(), pick(doc, selected))}
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">{g.title}</p>
          {g.rows.map((r) => (
            <label key={r.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-row-hover cursor-pointer">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-[var(--primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{r.label}</span>
                <span className="block text-[10px] text-foreground-muted">{r.detail}</span>
              </span>
              <span className={`text-xs tabular-nums ${r.amount < 0 ? "text-error" : "text-foreground"}`}>{fmtMoney(r.amount)}</span>
            </label>
          ))}
        </div>
      ))}
      {doc && groups.length === 0 && <p className="text-xs text-foreground-muted">No linked data found. Start with a blank plan instead.</p>}
    </AccountsModalShell>
  )
}
