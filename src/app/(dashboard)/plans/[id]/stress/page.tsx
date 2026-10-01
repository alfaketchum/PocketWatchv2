"use client"

import { use } from "react"
import { PlanStressPage } from "@/components/plans/stress/plan-stress-page"

export default function PlanStressRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <PlanStressPage planId={id} />
}
