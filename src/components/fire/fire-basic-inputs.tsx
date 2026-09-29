"use client"

import { cn } from "@/lib/utils"
import { BASIC_SWR_PRESETS } from "@/lib/fire/fire-constants"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { FireNumberField } from "./fire-number-field"

/** Plain-language assumptions editor shown inline under the hero in Basic mode. */
export function FireBasicInputs({ state }: { state: FirePlanState }) {
  const { inputs, update, plan, baseline } = state

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FireNumberField label="Your age" value={inputs.currentAge} min={10} max={100} onChange={(currentAge) => update({ currentAge })} />
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
          auto={{ isAuto: plan.contributionIsAuto, onReset: () => update({ annualContribution: null }) }}
        />
        <FireNumberField
          label="Part-time income / yr"
          prefix="$"
          value={inputs.partTimeIncome}
          min={0}
          onChange={(partTimeIncome) => update({ partTimeIncome })}
          hint="For Barista FIRE"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Safety level">
        {BASIC_SWR_PRESETS.map((p) => {
          const active = inputs.swrPreset === p.value
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={p.hint}
              onClick={() => update({ swrPreset: p.value })}
              className={cn(
                "text-left rounded-lg border px-3 py-2 text-xs transition-colors",
                active ? "border-primary bg-primary/5 text-primary font-semibold" : "border-card-border text-foreground-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
