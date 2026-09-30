"use client"

import { use } from "react"
import { PlanCashflowView } from "@/components/plans/cashflow/plan-cashflow-view"

export default function PlanCashflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PlanCashflowView planId={id} />
}
