"use client"

import dynamic from "next/dynamic"
import { useFirePlan } from "@/hooks/finance/use-fire-plan"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { FireHero } from "@/components/fire/fire-hero"
import { FireMilestones } from "@/components/fire/fire-milestones"
import { FireSpendingCost } from "@/components/fire/fire-spending-cost"
import { FireSafetyCard } from "@/components/fire/fire-safety-card"

const FirePathChart = dynamic(
  () => import("@/components/fire/fire-path-chart").then((m) => m.FirePathChart),
  { ssr: false, loading: () => <div className="h-[330px] animate-shimmer rounded-2xl" /> },
)

const FireWhatMoves = dynamic(
  () => import("@/components/fire/fire-what-moves").then((m) => m.FireWhatMoves),
  { ssr: false, loading: () => <div className="h-[300px] animate-shimmer rounded-2xl" /> },
)

export default function FirePage() {
  const state = useFirePlan()
  const { isHidden } = usePrivacyMode()
  const advanced = state.inputs.mode === "advanced"

  return (
    <div className="space-y-5">
      <FireHero state={state} isHidden={isHidden} />
      <FirePathChart state={state} isHidden={isHidden} />
      <FireWhatMoves state={state} />
      <FireMilestones state={state} isHidden={isHidden} />
      <FireSpendingCost state={state} isHidden={isHidden} />
      <FireSafetyCard state={state} isHidden={isHidden} />
      {!advanced && (
        <button
          type="button"
          onClick={() => state.update({ mode: "advanced" })}
          className="w-full rounded-2xl border border-dashed border-card-border p-4 text-xs text-foreground-muted hover:text-foreground hover:border-primary transition-colors"
        >
          See the full analysis — your portfolio mix, every historical retirement, CAPE and sequence risk → Advanced
        </button>
      )}
    </div>
  )
}
