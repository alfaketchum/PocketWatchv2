"use client"

import { Suspense, use } from "react"
import { PlanEditorView } from "@/components/plans/plan-editor-view"

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense>
      <PlanEditorView planId={id} />
    </Suspense>
  )
}
