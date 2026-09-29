"use client"

import { cn } from "@/lib/utils"
import { BASIC_SWR_PRESETS } from "@/lib/fire/fire-constants"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { FireNumberField } from "./fire-number-field"
import { FireSectionCard } from "./fire-section-card"

const SWR_INFO =
  "Your safe withdrawal rate (SWR) is the share of your nest egg you spend in year one, then adjust for inflation. " +
  "Lower = bigger nest egg needed, but it survives longer and worse markets."

/** The four plain-language inputs shown in Basic mode. */
export function FireBasicInputs({ state }: { state: FirePlanState }) {
  const { inputs, update, plan, baseline } = state

  return (
    <FireSectionCard eyebrow="Your numbers" info="Pre-filled from your accounts and last 12 months of spending. Change anything.">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FireNumberField
          label="Your age"
          value={inputs.currentAge}
          min={10}
          max={100}
          onChange={(currentAge) => update({ currentAge })}
        />
        <FireNumberField
          label="Yearly spending in retirement"
          prefix="$"
          value={Math.round(plan.annualSpend)}
          min={0}
          onChange={(annualSpend) => update({ annualSpend })}
          hint={baseline.avgAnnualSpend !== null ? `Last ${baseline.monthsOfData} months average` : "No spending history yet"}
          auto={{ isAuto: plan.spendIsAuto, onReset: () => update({ annualSpend: null }) }}
        />
        <FireNumberField
          label="Invested per year"
          prefix="$"
          value={Math.round(plan.annualContribution)}
          min={0}
          onChange={(annualContribution) => update({ annualContribution })}
          hint="Income minus spending"
          auto={{ isAuto: plan.contributionIsAuto, onReset: () => update({ annualContribution: null }) }}
        />
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium text-foreground-muted mb-2">How safe do you want to be?</p>
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
                <span className={cn("block text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
                  {p.label}
                </span>
                <span className="block text-[11px] text-foreground-muted mt-0.5">{p.hint}</span>
              </button>
            )
          })}
        </div>
        {!BASIC_SWR_PRESETS.some((p) => p.value === inputs.swrPreset) && (
          <p className="text-[11px] text-foreground-muted mt-2">
            Using your Advanced withdrawal setting ({(plan.swr * 100).toFixed(2)}%). Pick one above to switch.
          </p>
        )}
        <p className="text-[10px] text-foreground-muted mt-2">{SWR_INFO}</p>
      </div>
    </FireSectionCard>
  )
}
