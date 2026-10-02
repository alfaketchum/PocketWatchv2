"use client"

import { use } from "react"
import { PlanAdvancedGate } from "@/components/plans/plan-advanced-gate"
import { PlanLoansView } from "@/components/plans/loans/plan-loans-view"

export default function PlanLoansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <PlanAdvancedGate planId={id} title="Loans">
      <PlanLoansView planId={id} />
    </PlanAdvancedGate>
  )
}
