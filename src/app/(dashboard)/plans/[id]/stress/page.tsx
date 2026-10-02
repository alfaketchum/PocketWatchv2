"use client"

import { use } from "react"
import { PlanAdvancedGate } from "@/components/plans/plan-advanced-gate"
import { PlanStressPage } from "@/components/plans/stress/plan-stress-page"

export default function PlanStressRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <PlanAdvancedGate planId={id} title="The stress test">
      <PlanStressPage planId={id} />
    </PlanAdvancedGate>
  )
}
