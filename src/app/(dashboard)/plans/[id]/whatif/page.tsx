"use client"

import { Suspense, use } from "react"
import { PlanWhatIfPage } from "@/components/plans/what-if/plan-what-if-page"

export default function PlanWhatIfRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense>
      <PlanWhatIfPage planId={id} />
    </Suspense>
  )
}
