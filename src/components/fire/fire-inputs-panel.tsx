"use client"

import { DEFAULT_FIRE_INPUTS } from "@/lib/fire/fire-constants"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import {
  CryptoSection,
  IncomeSection,
  MilestonesSection,
  MoneySection,
  WithdrawalsSection,
  YouSection,
} from "./fire-input-sections"
import { FireSectionTabs, type EditorSection } from "./fire-section-tabs"

const SECTIONS: EditorSection[] = [
  { key: "you", label: "You", icon: "person", title: "You", description: "Your age and how long your money needs to last.", Body: YouSection },
  { key: "money", label: "Money", icon: "payments", title: "Money", description: "What you have invested and what you add each year.", Body: MoneySection },
  { key: "withdrawals", label: "Withdrawals", icon: "percent", title: "Withdrawals", description: "How much you take out in retirement, and how it's invested.", Body: WithdrawalsSection },
  { key: "income", label: "Income", icon: "savings", title: "Income", description: "Money that arrives after you stop working.", Body: IncomeSection },
  { key: "crypto", label: "Crypto", icon: "currency_bitcoin", title: "Crypto stress", description: "How hard to stress-test your crypto before counting on it.", Body: CryptoSection },
  { key: "milestones", label: "Milestones", icon: "flag", title: "Milestones", description: "What defines Barista FIRE and each lifestyle tier.", Body: MilestonesSection },
]

/** Advanced editor: every plan setting, one section at a time. */
export function FireInputsPanel({ state }: { state: FirePlanState }) {
  return (
    <FireSectionTabs
      sections={SECTIONS}
      state={state}
      initial="money"
      footer={
        <div className="flex justify-end mt-3">
          <button type="button" className="text-[11px] text-foreground-muted hover:text-error transition-colors" onClick={() => state.update({ ...DEFAULT_FIRE_INPUTS, mode: "advanced" })}>
            Reset everything to defaults
          </button>
        </div>
      }
    />
  )
}
