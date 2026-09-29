"use client"

import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtAge, fmtMoney, fmtPct, fmtYearsAway } from "./fire-helpers"
import { FireNumberField } from "./fire-number-field"
import { FireSectionCard } from "./fire-section-card"

function coastStatus(reached: boolean, years: number | null, gap: number): string {
  if (reached) return "You're already coasting — growth alone gets you there."
  if (years === null) return "Keep investing — you won't reach Coast FIRE before that age on this path."
  return `${fmtMoney(gap)} to go · keep investing ${fmtYearsAway(years)}, then you can stop contributing.`
}

/** Coast FIRE (stop contributing, let growth finish the job) and Barista FIRE (part-time income fills the gap). */
export function CoastBaristaCards({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { analysis, plan, inputs, update } = state
  const { coast, barista } = analysis

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FireSectionCard
        eyebrow="Coast FIRE"
        title={`Enough invested to retire at ${coast.coastAge} without adding another dollar`}
        info="The amount that, left alone at your real return, grows into your FIRE number by your traditional retirement age."
      >
        <BlurredValue isHidden={isHidden}>
          <p className="text-2xl font-bold text-foreground tabular-nums">{fmtMoney(coast.number)}</p>
        </BlurredValue>
        <p className="text-xs text-foreground-muted mt-1">
          {coastStatus(coast.reached, coast.yearsToCoast, Math.max(0, coast.number - plan.investable))}
        </p>
        <div className="mt-4 max-w-[180px]">
          <FireNumberField
            label="Traditional retirement age"
            value={inputs.coastAge}
            min={inputs.currentAge + 1}
            max={100}
            onChange={(coastAge) => update({ coastAge })}
          />
        </div>
      </FireSectionCard>

      <FireSectionCard
        eyebrow="Barista FIRE"
        title="Semi-retire with part-time income covering the gap"
        info="Quit full-time work once your portfolio covers spending minus part-time income."
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <BlurredValue isHidden={isHidden}>
            <p className="text-2xl font-bold text-foreground tabular-nums">{fmtMoney(barista.number)}</p>
          </BlurredValue>
          <p className="text-xs text-foreground-muted">
            {fmtPct(barista.progress.progress, 0)} · {fmtYearsAway(barista.progress.years)}
            {barista.progress.years ? ` · ${fmtAge(barista.progress.age)}` : ""}
          </p>
        </div>
        <p className="text-xs text-foreground-muted mt-1">
          {barista.gapToday > 0
            ? `If you downshifted today you'd need ${fmtMoney(barista.gapToday)}/yr from part-time work.`
            : "Your portfolio already covers your spending — no part-time income needed."}
        </p>
        <div className="mt-4 max-w-[180px]">
          <FireNumberField
            label="Part-time income / yr"
            prefix="$"
            value={inputs.partTimeIncome}
            min={0}
            onChange={(partTimeIncome) => update({ partTimeIncome })}
          />
        </div>
      </FireSectionCard>
    </div>
  )
}
