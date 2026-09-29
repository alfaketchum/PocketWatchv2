"use client"

import { useMemo } from "react"
import { baristaSimOptions } from "@/lib/fire/fire-analysis"
import { successRate } from "@/lib/fire/swr-simulation"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtMoney, fmtSuccess } from "./fire-helpers"
import { FireNumberField } from "./fire-number-field"

function planSentence(state: FirePlanState): string {
  const { barista } = state.analysis
  const years = barista.partTimeYears
  if (barista.progress.years === null) return "You don't reach the downshift point on your current path."
  const when = barista.progress.years <= 0 ? "now" : `at ${Math.floor(barista.downshiftAge ?? 0)}`
  const until = years === null ? "for the rest of your life" : `for ${years} years, fully retiring at ${Math.floor(barista.fullRetireAge ?? 0)}`
  return `With ${fmtMoney(barista.number)} invested you could leave full-time work ${when} and work part-time ${until}.`
}

/** Part-time income and duration for Barista FIRE, with a plain-language summary of the bridge. */
export function FireBaristaFields({ state }: { state: FirePlanState }) {
  const { inputs, update } = state
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[520px]">
        <FireNumberField
          label="Part-time income / yr"
          prefix="$"
          value={inputs.partTimeIncome}
          min={0}
          onChange={(partTimeIncome) => update({ partTimeIncome })}
        />
        <FireNumberField
          label="Years part-time (0 = for life)"
          value={inputs.partTimeYears ?? 0}
          min={0}
          max={60}
          onChange={(v) => update({ partTimeYears: v > 0 ? Math.round(v) : null })}
        />
      </div>
      <p className="text-xs text-foreground">{planSentence(state)}</p>
    </div>
  )
}

/** Advanced: the whole bridge (part-time years, then full retirement) run through every historical start. */
export function FireBaristaCheck({ state }: { state: FirePlanState }) {
  const { history, inputs, analysis, plan, allocation } = state
  const { barista } = analysis

  const rate = useMemo(() => {
    if (!history || barista.number <= 0 || barista.downshiftAge === null) return null
    const opts = baristaSimOptions(inputs, barista.downshiftAge, barista.number, allocation.total > 0 ? allocation.sim : null)
    return successRate(history, plan.annualSpend / barista.number, opts)
  }, [history, inputs, barista, plan.annualSpend, allocation])

  if (rate === null) return null
  return (
    <p className="text-xs text-foreground-muted">
      Historical check: downshifting with {fmtMoney(barista.number)} and working part-time as planned lasted{" "}
      <b className="text-foreground">{inputs.horizonYears} years in {fmtSuccess(rate)}</b> of retirements since 1871.
    </p>
  )
}
