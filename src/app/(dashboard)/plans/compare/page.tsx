"use client"

import { Suspense } from "react"
import { CompareView } from "@/components/plans/compare/compare-view"

export default function PlansComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  )
}
