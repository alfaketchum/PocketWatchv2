import type { ReactNode } from "react"
import { PlansHeader } from "@/components/plans/plans-header"

export default function PlansLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 fade-in">
      <PlansHeader />
      {children}
    </div>
  )
}
