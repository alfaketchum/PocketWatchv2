"use client"

import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtAge, fmtMoney, fmtPct, fmtYearsAway } from "./fire-helpers"
import { FireAssumptionsRow } from "./fire-assumptions-row"

function headline(years: number | null, age: number | null, year: number | null): string {
  if (years === null) return "Not reachable on your current path"
  if (years <= 0) return "You're financially independent"
  return `You can retire ${fmtYearsAway(years)} — ${fmtAge(age)}, around ${Math.floor(year ?? 0)}`
}

export function FireHero({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { analysis, plan, baseline, isLoading, fiRange, inputs } = state
  const t = analysis.yourTarget
  const showRange = inputs.mode === "advanced" && fiRange && t.years !== null && t.years > 0

  if (isLoading) {
    return <div className="h-[188px] animate-shimmer rounded-2xl" />
  }

  const stats = [
    { label: "FIRE number", value: fmtMoney(analysis.fireNumber), sub: `${fmtMoney(plan.annualSpend)}/yr at ${fmtPct(plan.swr, 2)}` },
    { label: "Invested now", value: fmtMoney(plan.investable), sub: plan.investableIsAuto ? "From your accounts" : "Manual" },
    { label: "Investing each year until FI", value: fmtMoney(plan.annualContribution), sub: baseline.annualIncome ? `${fmtPct(plan.annualContribution / baseline.annualIncome, 0)} of income` : " " },
  ]

  return (
    <section
      className="relative overflow-hidden bg-card border border-card-border rounded-2xl p-5 sm:p-6"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Your FIRE date</p>
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">{headline(t.years, t.age, t.year)}</h2>
      {showRange && (
        <p className="text-xs text-foreground-muted mt-1">
          Across history since 1871: {fiRange.p10.toFixed(1)}–{fiRange.p90.toFixed(1)} years (age{" "}
          {Math.floor(inputs.currentAge + fiRange.p10)}–{Math.floor(inputs.currentAge + fiRange.p90)}), typically{" "}
          {fiRange.p50.toFixed(1)}. The headline assumes a steady {(inputs.realReturn * 100).toFixed(1)}% real return.
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-foreground-muted mb-1.5">
          <span>{fmtPct(t.progress, 0)} of the way there</span>
          <BlurredValue isHidden={isHidden}>
            <span className="tabular-nums">{fmtMoney(plan.investable)} / {fmtMoney(analysis.fireNumber)}</span>
          </BlurredValue>
        </div>
        <div className="h-2.5 rounded-full bg-foreground/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-warning to-error transition-[width] duration-700"
            style={{ width: `${Math.max(2, t.progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] text-foreground-muted">{s.label}</p>
            <BlurredValue isHidden={isHidden}>
              <p className="text-lg font-semibold text-foreground tabular-nums">{s.value}</p>
            </BlurredValue>
            <p className="text-[10px] text-foreground-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      <FireAssumptionsRow state={state} />
    </section>
  )
}
