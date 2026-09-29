import type { ReactNode } from "react"
import { FireHeader } from "@/components/fire/fire-header"

export default function FireLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 fade-in">
      <FireHeader />
      {children}
    </div>
  )
}
