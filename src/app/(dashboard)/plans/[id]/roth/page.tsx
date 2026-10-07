"use client"

import { use } from "react"
import { PlanAdvancedGate } from "@/components/plans/plan-advanced-gate"
import { PlanRothView } from "@/components/plans/roth/plan-roth-view"

export default function PlanRothPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <PlanAdvancedGate planId={id} title="Roth conversions">
      <PlanRothView planId={id} />
    </PlanAdvancedGate>
  )
}
