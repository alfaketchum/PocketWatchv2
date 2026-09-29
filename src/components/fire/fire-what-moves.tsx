"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { savingsRateCurve, yearsAtSavingsRate } from "@/lib/fire/fire-growth"
import type { SensitivityItem } from "@/lib/fire/fire-sensitivity"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

/** Cap the curve's y-axis so very low savings rates don't flatten the interesting part. */
const MAX_YEARS_SHOWN = 60
const RATE_STEP = 0.05

function fmtDelta(years: number | null): string {
  if (years === null) return "—"
  const abs = Math.abs(years)
  if (abs < 1 / 24) return "no change"
  const amount = abs < 1 ? `${Math.max(1, Math.round(abs * 12))} mo` : `${abs.toFixed(1)} yrs`
  return years < 0 ? `${amount} sooner` : `${amount} later`
}

function SavingsRateCurve({ state }: { state: FirePlanState }) {
  const { plan, inputs } = state
  const { primary, warning, foregroundMuted, border } = useChartTheme()
  const { points, current } = useMemo(
    () => savingsRateCurve(plan.investable, plan.annualSpend, plan.annualContribution, inputs.realReturn, plan.swr),
    [plan, inputs.realReturn],
  )
  if (!current || current.years === null) return null
  const data = points.filter((p) => p.years !== null && p.years <= MAX_YEARS_SHOWN).map((p) => ({ rate: p.rate, years: p.years }))
  const income = plan.annualSpend + plan.annualContribution
  const plus5Years = current.rate + RATE_STEP < 1 ? yearsAtSavingsRate(plan.investable, income, current.rate + RATE_STEP, inputs.realReturn, plan.swr) : null

  return (
    <div className="mb-3">
      <p className="text-xs text-foreground mb-2">
        You save <b>{fmtPct(current.rate, 0)}</b> of what you take home.
        {plus5Years !== null && <> Saving 5% more gets you there {fmtDelta(plus5Years - current.years)}.</>}
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
          <XAxis dataKey="rate" type="number" domain={[0.05, 0.9]} tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => fmtPct(v, 0)} axisLine={false} tickLine={false} />
          <YAxis dataKey="years" tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => `${Math.round(v)}y`} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            formatter={(v?: number) => [`${(v ?? 0).toFixed(1)} years`, "To FI"]}
            labelFormatter={(r) => `Savings rate ${fmtPct(Number(r), 0)}`}
            contentStyle={{ fontSize: 11 }}
          />
          <Line type="monotone" dataKey="years" stroke={primary} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          <ReferenceDot x={current.rate} y={Math.min(current.years, MAX_YEARS_SHOWN)} r={5} fill={warning} stroke="none" label={{ value: "You", position: "top", fontSize: 10, fill: warning }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** "What moves your date": your spot on the savings-rate curve plus three quick what-ifs. */
export function FireWhatMoves({ state }: { state: FirePlanState }) {
  const items: SensitivityItem[] = state.sensitivity
  if (items.every((i) => i.deltaYears === null)) return null
  return (
    <FireSectionCard
      eyebrow="What moves your date"
      info="The curve is Mr. Money Mustache's savings-rate chart, personalized: for your take-home income (spending + investing), years to FI at each savings rate from today's portfolio."
    >
      <SavingsRateCurve state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.key} className="rounded-lg bg-foreground/[0.03] px-3 py-2">
            <p className="text-xs text-foreground">{i.label}</p>
            <p className={cn("text-sm font-semibold tabular-nums", i.deltaYears === null ? "text-foreground-muted" : i.deltaYears < 0 ? "text-success" : "text-error")}>
              {fmtDelta(i.deltaYears)}
            </p>
          </div>
        ))}
      </div>
    </FireSectionCard>
  )
}
