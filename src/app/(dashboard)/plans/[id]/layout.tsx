"use client"

import { use, type ReactNode } from "react"
import { PlanPagesNav } from "@/components/plans/plan-pages-nav"

/** Every page of a plan shares the page row on top, so moving between them never shifts it. */
export default function PlanLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="space-y-5">
      <PlanPagesNav planId={id} />
      {children}
    </div>
  )
}
