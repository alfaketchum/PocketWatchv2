"use client"

import dynamic from "next/dynamic"
import { useFirePlan } from "@/hooks/finance/use-fire-plan"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { FireHero } from "@/components/fire/fire-hero"
import { FireBasicInputs } from "@/components/fire/fire-basic-inputs"
import { FireInputsPanel } from "@/components/fire/fire-inputs-panel"
import { FireTierLadder } from "@/components/fire/fire-tier-ladder"
import { CoastBaristaCards } from "@/components/fire/coast-barista-cards"
import { FireSafetyCard } from "@/components/fire/fire-safety-card"
import { CapeRuleCard } from "@/components/fire/cape-rule-card"

const FireProjectionChart = dynamic(
  () => import("@/components/fire/fire-projection-chart").then((m) => m.FireProjectionChart),
  { ssr: false, loading: () => <div className="h-[340px] animate-shimmer rounded-2xl" /> },
)

export default function FirePage() {
  const state = useFirePlan()
  const { isHidden } = usePrivacyMode()
  const advanced = state.inputs.mode === "advanced"

  return (
    <div className="space-y-6">
      <FireHero state={state} isHidden={isHidden} />
      {advanced ? <FireInputsPanel state={state} /> : <FireBasicInputs state={state} />}
      <FireTierLadder state={state} isHidden={isHidden} />
      <FireProjectionChart state={state} isHidden={isHidden} />
      <div className={advanced ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : undefined}>
        <FireSafetyCard state={state} />
        {advanced && <CapeRuleCard state={state} isHidden={isHidden} />}
      </div>
      <CoastBaristaCards state={state} isHidden={isHidden} />
      {!advanced && (
        <button
          type="button"
          onClick={() => state.update({ mode: "advanced" })}
          className="w-full rounded-2xl border border-dashed border-card-border p-4 text-sm text-foreground-muted hover:text-foreground hover:border-primary transition-colors"
        >
          <span className="material-symbols-rounded align-middle mr-1" style={{ fontSize: 18 }}>science</span>
          See the full analysis — withdrawal-rate heatmaps, every historical retirement, CAPE and sequence risk → Advanced
        </button>
      )}
      {advanced && (
        <p className="text-[11px] text-foreground-muted">
          Historical analysis follows Big ERN&apos;s{" "}
          <a href="https://earlyretirementnow.com/safe-withdrawal-rate-series/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Safe Withdrawal Rate Series
          </a>{" "}
          using Robert Shiller&apos;s monthly data. Explore it in the Safe Withdrawal Lab.
        </p>
      )}
    </div>
  )
}
