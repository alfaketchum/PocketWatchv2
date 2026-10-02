"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { useLinkedSources } from "@/hooks/plans/use-linked-sources"
import { applyNewSource, ignoreNewSource, newSourceRefId, newSources, type NewSource } from "@/lib/plans/plan-new-sources"
import { newItemId, type PlanEditorProps } from "../plans-helpers"

function Suggestion({ s, update }: { s: NewSource; update: PlanEditorProps["update"] }) {
  const name = s.type === "account" ? s.account.name : s.debt.name
  const detail =
    s.type === "account"
      ? `${fmtMoney(s.account.balance)} today. Add it with today's balance; you can change anything after.`
      : `${fmtMoney(s.debt.balance)} owed at ${(s.debt.rate * 100).toFixed(2)}%, ${fmtMoney(s.debt.monthlyPayment)}/mo. Add it as running from today.`
  return (
    <li className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{name} isn&apos;t in this plan</p>
        <p className="text-xs text-foreground-muted">{detail}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost text-xs" onClick={() => update((d) => ignoreNewSource(d, s))}>
          Not in this plan
        </button>
        <button type="button" className="btn-primary text-xs" onClick={() => update((d) => applyNewSource(d, s, newItemId))}>
          Add it
        </button>
      </div>
    </li>
  )
}

/** Accounts (or loans) linked since this plan was created that it doesn't have; nothing changes until the user picks. */
export function PlanNewSources({ doc, update, planCreatedAt, show }: Pick<PlanEditorProps, "doc" | "update" | "planCreatedAt"> & { show: NewSource["type"] }) {
  const linked = useLinkedSources()
  if (!linked.data || !planCreatedAt) return null
  const suggestions = newSources(doc, linked.data, planCreatedAt).filter((s) => s.type === show)
  if (suggestions.length === 0) return null
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Linked since you made this plan</p>
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <Suggestion key={newSourceRefId(s)} s={s} update={update} />
        ))}
      </ul>
    </div>
  )
}
