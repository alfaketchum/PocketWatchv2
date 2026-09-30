"use client"

import { useState } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { useLinkedLoans } from "@/hooks/plans/use-linked-loans"
import { applyLoanAsAsset, applyLoanLink, ignoreLoan, loanSuggestions, type LoanSuggestion } from "@/lib/plans/plan-loan-matching"
import type { PlanDebt } from "@/lib/plans/plan-types"
import { newItemId, type PlanEditorProps } from "../plans-helpers"

const KIND_WORD = { home: "home", vehicle: "car", other: "asset" } as const

function loanLine(debt: PlanDebt): string {
  return `${fmtMoney(debt.balance)} at ${(debt.rate * 100).toFixed(2)}%, ${fmtMoney(debt.monthlyPayment)}/mo`
}

function Suggestion({ s, update }: { s: LoanSuggestion; update: PlanEditorProps["update"] }) {
  const [value, setValue] = useState(s.type === "addAsset" ? s.estimatedValue : 0)
  const ignore = (
    <button type="button" className="btn-ghost text-xs" onClick={() => update((d) => ignoreLoan(d, s.debt))}>
      Not in this plan
    </button>
  )
  if (s.type === "link") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Looks like you bought {s.asset.name}</p>
          <p className="text-xs text-foreground-muted">
            {s.debt.name}: {loanLine(s.debt)}. Using it marks {s.asset.name} as owned now, paid with this loan instead of the planned one.
          </p>
        </div>
        <div className="flex gap-2">
          {ignore}
          <button type="button" className="btn-primary text-xs" onClick={() => update((d) => applyLoanLink(d, s.debt, s.asset.id))}>
            Use this loan
          </button>
        </div>
      </li>
    )
  }
  return (
    <li className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium text-foreground">
          {s.debt.name} isn&apos;t paying for anything in this plan
        </p>
        <p className="text-xs text-foreground-muted">
          {loanLine(s.debt)}. Add the {KIND_WORD[s.kind]} it&apos;s for, owned now with this loan. The value is estimated from the loan; change it
          if you know better.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <div className="w-36">
          <FireNumberField label="Worth today" prefix="$" min={0} value={value} onChange={setValue} />
        </div>
        {ignore}
        <button type="button" className="btn-primary text-xs" onClick={() => update((d) => applyLoanAsAsset(d, s.debt, s.kind, value, newItemId))}>
          Add {KIND_WORD[s.kind]}
        </button>
      </div>
    </li>
  )
}

/** Mortgages and auto loans in linked accounts that this plan doesn't have yet, matched to its homes and cars. */
export function PlanLoanSuggestions({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const loans = useLinkedLoans()
  const suggestions = loans.data ? loanSuggestions(doc, loans.data) : []
  if (suggestions.length === 0) return null
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">From your linked accounts</p>
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <Suggestion key={s.debt.id} s={s} update={update} />
        ))}
      </ul>
    </div>
  )
}
