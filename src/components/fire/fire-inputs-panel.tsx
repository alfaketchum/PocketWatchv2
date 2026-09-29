"use client"

import { useState, type ComponentType } from "react"
import { cn } from "@/lib/utils"
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

interface Section {
  key: string
  label: string
  icon: string
  title: string
  description: string
  Body: ComponentType<{ state: FirePlanState }>
}

const SECTIONS: Section[] = [
  { key: "you", label: "You", icon: "person", title: "You", description: "Your age and how long your money needs to last.", Body: YouSection },
  { key: "money", label: "Money", icon: "payments", title: "Money", description: "What you have invested and what you add each year.", Body: MoneySection },
  { key: "withdrawals", label: "Withdrawals", icon: "percent", title: "Withdrawals", description: "How much you take out in retirement, and how it's invested.", Body: WithdrawalsSection },
  { key: "income", label: "Income", icon: "savings", title: "Income", description: "Money that arrives after you stop working.", Body: IncomeSection },
  { key: "crypto", label: "Crypto", icon: "currency_bitcoin", title: "Crypto stress", description: "How hard to stress-test your crypto before counting on it.", Body: CryptoSection },
  { key: "milestones", label: "Milestones", icon: "flag", title: "Milestones", description: "What defines Barista FIRE and each lifestyle tier.", Body: MilestonesSection },
]

/** Advanced editor: one section at a time behind icon tabs, each with a heading and one-line purpose. */
export function FireInputsPanel({ state }: { state: FirePlanState }) {
  const [active, setActive] = useState(SECTIONS[1].key)
  const section = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0]
  const { Body } = section

  return (
    <div>
      <div role="tablist" aria-label="Plan settings" className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {SECTIONS.map((s) => {
          const selected = s.key === section.key
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                selected ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <span className={cn("material-symbols-rounded", selected && "filled")} style={{ fontSize: 18 }}>{s.icon}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="mt-4 rounded-xl border border-card-border p-4 sm:p-5">
        <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
        <p className="text-xs text-foreground-muted mt-0.5 mb-5">{section.description}</p>
        <Body state={state} />
      </div>

      <div className="flex justify-end mt-3">
        <button type="button" className="text-[11px] text-foreground-muted hover:text-error transition-colors" onClick={() => state.update({ ...DEFAULT_FIRE_INPUTS, mode: "advanced" })}>
          Reset everything to defaults
        </button>
      </div>
    </div>
  )
}
