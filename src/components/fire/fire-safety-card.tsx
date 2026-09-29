"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { NOTABLE_COHORTS } from "@/lib/fire/fire-constants"
import { cohortCount, failsafe, simulateCohort, successRate, summarizeCohorts } from "@/lib/fire/swr-simulation"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtMonth, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

function verdict(rate: number): { label: string; tone: string } {
  if (rate >= 0.99) return { label: "Very safe", tone: "text-success" }
  if (rate >= 0.95) return { label: "Safe", tone: "text-success" }
  if (rate >= 0.85) return { label: "Some risk", tone: "text-warning" }
  return { label: "Risky", tone: "text-error" }
}

/** Plain-English historical backtest of the user's withdrawal rate (ERN-style cohorts since 1871). */
export function FireSafetyCard({ state }: { state: FirePlanState }) {
  const { history, simOptions, plan, inputs } = state

  const result = useMemo(() => {
    if (!history) return null
    const rate = successRate(history, plan.swr, simOptions)
    const worst = failsafe(summarizeCohorts(history, simOptions))
    const count = cohortCount(history, simOptions.horizonMonths)
    const notable = NOTABLE_COHORTS.map((ym) => {
      const idx = history.months.indexOf(ym)
      if (idx < 0 || idx >= count) return null
      const path = simulateCohort(history, idx, plan.swr, simOptions)
      return { ym, survived: path[path.length - 1] > 0, final: path[path.length - 1] }
    }).filter((n): n is NonNullable<typeof n> => n !== null)
    return { rate, worst, count, notable }
  }, [history, plan.swr, simOptions])

  if (!result || result.rate === null) {
    return <div className="h-[180px] animate-shimmer rounded-2xl" />
  }

  const v = verdict(result.rate)
  const failed = Math.round((1 - result.rate) * result.count)

  return (
    <FireSectionCard
      eyebrow="How safe is this?"
      info={`Every ${inputs.horizonYears}-year retirement starting any month from 1871 to ${fmtMonth(history!.months[result.count - 1])}, with real stock and bond returns (Shiller data, ERN method).`}
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <p className={cn("text-3xl font-bold tabular-nums", v.tone)}>{fmtPct(result.rate, 0)}</p>
        <p className={cn("text-sm font-semibold", v.tone)}>{v.label}</p>
      </div>
      <p className="text-sm text-foreground mt-2">
        Withdrawing {fmtPct(plan.swr, 2)} a year, your plan lasted {inputs.horizonYears} years in{" "}
        <span className="font-semibold">{result.count - failed} of {result.count}</span> historical retirements
        {failed > 0 ? ` and ran out in ${failed}.` : " — every single one."}
      </p>
      {result.worst && (
        <p className="text-xs text-foreground-muted mt-1">
          The worst time to retire was {fmtMonth(result.worst.month)}: it could only support{" "}
          {fmtPct(result.worst.wr, 2)}.
        </p>
      )}
      {result.notable.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {result.notable.map((n) => (
            <span
              key={n.ym}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                n.survived ? "bg-success/10 text-success" : "bg-error/10 text-error",
              )}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 12 }}>{n.survived ? "check" : "close"}</span>
              Retire {fmtMonth(n.ym)}
            </span>
          ))}
        </div>
      )}
    </FireSectionCard>
  )
}
