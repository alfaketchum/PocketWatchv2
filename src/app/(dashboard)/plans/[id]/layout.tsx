"use client"

import { use, type ReactNode } from "react"
import { HeaderTools } from "@/components/layout/header-tools"
import { PlanPagesNav } from "@/components/plans/plan-pages-nav"

/**
 * Every page of a plan shares its tabs: up in the top bar on wide screens (leaving the page more room), and on top
 * of the page below that.
 */
export default function PlanLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="space-y-5">
      <HeaderTools slot="nav">
        <PlanPagesNav planId={id} inHeader />
      </HeaderTools>
      <div className="flex justify-center lg:hidden">
        <PlanPagesNav planId={id} />
      </div>
      {children}
    </div>
  )
}
