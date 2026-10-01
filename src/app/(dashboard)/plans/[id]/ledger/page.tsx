"use client"

import { use } from "react"
import { PlanLedgerView } from "@/components/plans/ledger/plan-ledger-view"

export default function PlanLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PlanLedgerView planId={id} />
}
