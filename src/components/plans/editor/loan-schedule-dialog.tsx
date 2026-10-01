"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { AccountsModalShell } from "@/components/accounts/accounts-modal-shell"
import { expandPlan } from "@/lib/plans/plan-expand"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { LoanScheduleBody } from "./loan-schedule-body"

/** A loan's amortization schedule as a pop-out from Assets & debts, with a way on to the Loans page. */
export function LoanScheduleDialog({ doc, debtId, onClose }: { doc: PlanDocument; debtId: string; onClose: () => void }) {
  const pathname = usePathname()
  const name = useMemo(() => expandPlan(doc).debts.find((d) => d.id === debtId)?.name, [doc, debtId])
  return (
    <AccountsModalShell
      wide
      title={name ? `${name}: amortization schedule` : "Amortization schedule"}
      onClose={onClose}
      footer={
        <>
          <Link href={`${pathname}/loans`} className="btn-ghost text-sm mr-auto text-primary">
            Pay extra or invest? Compare →
          </Link>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </>
      }
    >
      <LoanScheduleBody doc={doc} debtId={debtId} />
    </AccountsModalShell>
  )
}
