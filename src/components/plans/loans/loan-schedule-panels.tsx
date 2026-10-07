"use client"

import { useMemo, useState } from "react"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { expandPlan } from "@/lib/plans/plan-expand"
import { inflationOf, priceIndex } from "@/lib/plans/plan-inflation"
import { resolveTiming, timingContext } from "@/lib/plans/plan-timing"
import type { PlanDebt, PlanDocument } from "@/lib/plans/plan-types"
import { LoanScheduleBody } from "../editor/loan-schedule-body"

/** Loans that get a schedule: everything but card balances and later replacement cycles' loans. */
function scheduledLoans(doc: PlanDocument): PlanDebt[] {
  return expandPlan(doc).debts.filter((d) => d.kind !== "credit" && d.balance > 0 && !d.id.includes("~"))
}

function LoanSchedulePanel({ doc, debt, defaultOpen }: { doc: PlanDocument; debt: PlanDebt; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const index = Math.max(0, resolveTiming(debt.start, timingContext(doc)) ?? 0)
  const start = doc.settings.startYear + index
  // A loan taken out later is sized in that year's dollars; say what it is today too.
  const deflator = priceIndex(inflationOf(doc.settings), index)
  const today = deflator > 1 ? ` (≈ ${fmtMoney(debt.balance / deflator)} today)` : ""
  return (
    <FireSectionCard
      eyebrow="Amortization schedule"
      title={`${debt.name}: ${fmtMoney(debt.balance)} at ${(debt.rate * 100).toFixed(2)}% from ${start}${today}`}
      right={
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-ghost h-8 gap-1 px-2 text-xs text-foreground-muted hover:text-foreground">
          {open ? "Hide" : "Show"}
          <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>
      }
    >
      {open && <LoanScheduleBody doc={doc} debtId={debt.id} />}
    </FireSectionCard>
  )
}

/** One amortization panel per loan in the plan; the first starts open. */
export function LoanSchedulePanels({ doc, isHidden }: { doc: PlanDocument; isHidden: boolean }) {
  const loans = useMemo(() => scheduledLoans(doc), [doc])
  if (loans.length === 0) return null
  return (
    <div className="space-y-5" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
      {loans.map((debt, i) => (
        <LoanSchedulePanel key={debt.id} doc={doc} debt={debt} defaultOpen={i === 0} />
      ))}
    </div>
  )
}
