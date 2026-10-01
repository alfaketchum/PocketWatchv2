"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { usePlanDocument } from "@/hooks/plans/use-plan-document"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { loanChoices, termRates, payoffExtra, type LoanChoice, type LoanTerm } from "@/lib/plans/plan-loan-options"
import type { PlanDocument } from "@/lib/plans/plan-types"
import type { DocUpdater } from "../plans-helpers"
import { SelectField } from "../editor/plan-editor-controls"
import { LoanCompare } from "./loan-compare"

/** A first custom extra: what clears the loan in 15 years, rounded to $50, or $200. */
const ROUND_TO = 50
const FALLBACK_EXTRA = 200

function firstExtra(choice: LoanChoice): number {
  if (choice.extra > 0) return choice.extra
  const fifteen = payoffExtra(choice, 15)
  return fifteen ? Math.round(fifteen / ROUND_TO) * ROUND_TO : FALLBACK_EXTRA
}

function LoanPicker({ doc, update, planId, isHidden }: { doc: PlanDocument; update: (u: DocUpdater) => void; planId: string; isHidden: boolean }) {
  const choices = useMemo(() => loanChoices(doc), [doc])
  const [selected, setSelected] = useState<string | null>(null)
  const choice = choices.find((c) => c.id === selected) ?? choices[0]
  const [extra, setExtra] = useState<number | null>(null)
  const [rates, setRates] = useState<Record<LoanTerm, number> | null>(null)
  useEffect(() => {
    setExtra(null)
    setRates(null)
  }, [choice?.id])

  if (!choice) {
    return (
      <EmptyState
        icon="request_quote"
        title="No loans to compare"
        description="Add a mortgage or other loan, or a purchase paid with a loan, on Assets & debts."
        action={{ label: "Go to Assets & debts", href: `/plans/${planId}?tab=assets` }}
      />
    )
  }
  return (
    <div className="space-y-5">
      {choices.length > 1 && (
        <div className="max-w-xs">
          <SelectField label="Loan" value={choice.id} options={choices.map((c) => ({ value: c.id, label: c.name }))} onChange={setSelected} />
        </div>
      )}
      <LoanCompare
        doc={doc}
        update={update}
        choice={choice}
        extra={extra ?? firstExtra(choice)}
        onExtra={setExtra}
        rates={rates ?? termRates(choice)}
        onRates={setRates}
        isHidden={isHidden}
      />
    </div>
  )
}

/** A plan's loans page: pay extra, invest the difference, or pick a shorter term. */
export function PlanLoansView({ planId }: { planId: string }) {
  const { plan, document: doc, update, isLoading } = usePlanDocument(planId)
  const { isHidden } = usePrivacyMode()

  if (isLoading) return <div className="h-[520px] animate-shimmer rounded-2xl" />
  if (!plan || !doc) {
    return <EmptyState icon="error" variant="error" title="Couldn't open this plan" description="It may have been deleted." action={{ label: "Back to plans", href: "/plans" }} />
  }
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={`/plans/${planId}`} className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
            arrow_back
          </span>
          {plan.name}
        </Link>
        <div>
          <h1 className="text-2xl text-foreground font-semibold">Loans</h1>
          <p className="text-xs text-foreground-muted mt-0.5">Pay extra, invest the difference, or take a shorter loan: what each does to your whole plan</p>
        </div>
      </div>
      <LoanPicker doc={doc} update={update} planId={planId} isHidden={isHidden} />
    </div>
  )
}
