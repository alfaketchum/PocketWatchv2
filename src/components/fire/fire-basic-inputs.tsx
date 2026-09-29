"use client"

import { cn } from "@/lib/utils"
import { BASIC_SWR_PRESETS } from "@/lib/fire/fire-constants"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { FireNumberField } from "./fire-number-field"
import { FireSectionTabs, type EditorSection } from "./fire-section-tabs"

type SectionProps = { state: FirePlanState }

function YouBasic({ state }: SectionProps) {
  const { inputs, update } = state
  return (
    <div className="max-w-[200px]">
      <FireNumberField label="Your age" value={inputs.currentAge} min={10} max={100} onChange={(currentAge) => update({ currentAge })} />
    </div>
  )
}

function MoneyBasic({ state }: SectionProps) {
  const { update, plan, baseline } = state
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[520px]">
      <FireNumberField
        label="Spending / yr"
        prefix="$"
        value={Math.round(plan.annualSpend)}
        min={0}
        onChange={(annualSpend) => update({ annualSpend })}
        hint={baseline.avgAnnualSpend !== null ? `Your last ${baseline.monthsOfData} months` : undefined}
        auto={{ isAuto: plan.spendIsAuto, onReset: () => update({ annualSpend: null }) }}
      />
      <FireNumberField
        label="Invested / yr"
        prefix="$"
        value={Math.round(plan.annualContribution)}
        min={0}
        onChange={(annualContribution) => update({ annualContribution })}
        hint="Income minus spending"
        auto={{ isAuto: plan.contributionIsAuto, onReset: () => update({ annualContribution: null }) }}
      />
    </div>
  )
}

function SafetyBasic({ state }: SectionProps) {
  const { inputs, update, plan } = state
  const custom = !BASIC_SWR_PRESETS.some((p) => p.value === inputs.swrPreset)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Safety level">
        {BASIC_SWR_PRESETS.map((p) => {
          const active = inputs.swrPreset === p.value
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update({ swrPreset: p.value })}
              className={cn(
                "text-left rounded-xl border px-3 py-2.5 transition-colors",
                active ? "border-primary bg-primary/5" : "border-card-border hover:border-foreground-muted/40",
              )}
            >
              <span className={cn("block text-sm font-semibold", active ? "text-primary" : "text-foreground")}>{p.label}</span>
              <span className="block text-[11px] text-foreground-muted mt-0.5">{p.hint}</span>
            </button>
          )
        })}
      </div>
      {custom && (
        <p className="text-[11px] text-foreground-muted">
          Using your Advanced setting ({(plan.swr * 100).toFixed(2)}%). Pick one above to switch.
        </p>
      )}
    </div>
  )
}

function BaristaBasic({ state }: SectionProps) {
  const { inputs, update } = state
  return (
    <div className="max-w-[240px]">
      <FireNumberField label="Part-time income / yr" prefix="$" value={inputs.partTimeIncome} min={0} onChange={(partTimeIncome) => update({ partTimeIncome })} />
    </div>
  )
}

const SECTIONS: EditorSection[] = [
  { key: "you", label: "You", icon: "person", title: "You", description: "Your age today.", Body: YouBasic },
  { key: "money", label: "Money", icon: "payments", title: "Money", description: "What you'll spend each year in retirement and what you invest today.", Body: MoneyBasic },
  { key: "safety", label: "Safety", icon: "shield", title: "How safe do you want to be?", description: "A lower withdrawal rate needs a bigger nest egg but survives worse markets.", Body: SafetyBasic },
  { key: "barista", label: "Barista", icon: "local_cafe", title: "Barista FIRE", description: "Part-time income you'd earn after leaving full-time work.", Body: BaristaBasic },
]

/** Basic editor: the few assumptions that matter, one tab at a time. */
export function FireBasicInputs({ state }: { state: FirePlanState }) {
  return <FireSectionTabs sections={SECTIONS} state={state} initial="money" />
}
