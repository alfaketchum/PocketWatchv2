"use client"

import { useFirePlan } from "@/hooks/finance/use-fire-plan"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { PortfolioAllocation } from "@/components/fire/portfolio-allocation"
import { PortfolioRiskChecks } from "@/components/fire/portfolio-risk-checks"
import { AccountMixEditor } from "@/components/fire/account-mix-editor"
import { FireAdvancedGate } from "@/components/fire/fire-advanced-gate"

export default function FirePortfolioPage() {
  const state = useFirePlan()
  const { isHidden } = usePrivacyMode()

  if (state.inputs.mode !== "advanced") {
    return <FireAdvancedGate title="Your portfolio breakdown is part of Advanced mode" onSwitch={() => state.update({ mode: "advanced" })} />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PortfolioAllocation state={state} isHidden={isHidden} />
        <PortfolioRiskChecks state={state} />
      </div>
      <AccountMixEditor state={state} isHidden={isHidden} />
    </div>
  )
}
