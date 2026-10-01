"use client"

import { use } from "react"
import { PlanLoansView } from "@/components/plans/loans/plan-loans-view"

export default function PlanLoansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PlanLoansView planId={id} />
}
