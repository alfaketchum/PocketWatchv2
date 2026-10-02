"use client"

import { use } from "react"
import { PlanAdvancedGate } from "@/components/plans/plan-advanced-gate"
import { PlanTradingView } from "@/components/plans/trading/plan-trading-view"

export default function PlanTradingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <PlanAdvancedGate planId={id} title="Trading">
      <PlanTradingView planId={id} />
    </PlanAdvancedGate>
  )
}
