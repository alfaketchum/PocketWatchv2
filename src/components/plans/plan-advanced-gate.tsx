"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"

/** An Advanced-only plan page: in Basic it offers to switch instead of showing the page. */
export function PlanAdvancedGate({ planId, title, children }: { planId: string; title: string; children: ReactNode }) {
  const { isBasic, setMode } = usePlanMode()
  if (!isBasic) return <>{children}</>
  return (
    <div className="space-y-4">
      <Link href={`/plans/${planId}`} className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground">
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
          arrow_back
        </span>
        Back to plan
      </Link>
      <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
        <span className="material-symbols-rounded text-primary mb-2 block" style={{ fontSize: 32 }}>
          science
        </span>
        <p className="text-sm text-foreground font-semibold">{title} is part of Advanced mode</p>
        <button type="button" className="btn-primary mt-4" onClick={() => setMode("advanced")}>
          Switch to Advanced
        </button>
      </div>
    </div>
  )
}
