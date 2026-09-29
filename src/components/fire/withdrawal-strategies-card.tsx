"use client"

import { useMemo, useState } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { STRATEGIES, simulateStrategy, summarizeStrategy, type StrategyKey, type StrategyOptions } from "@/lib/fire/withdrawal-strategies"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtMoney, fmtMonth, fmtSuccess } from "./fire-helpers"
import { ChoiceChips } from "./fire-input-controls"
import { FireSectionCard } from "./fire-section-card"

const COHORTS = ["1929-09", "1966-01", "1973-01", "2000-01"] as const

interface Row {
  year: number
  fixed?: number
  percent?: number
  cape?: number
  guardrails?: number
}

/** FI Calc-style comparison: how spending would have moved under each withdrawal rule. */
export function WithdrawalStrategiesCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { history, plan, inputs, simOptions } = state
  const [cohort, setCohort] = useState<(typeof COHORTS)[number]>("1966-01")
  const { palette, foregroundMuted, border, warning } = useChartTheme()

  const base = useMemo<Omit<StrategyOptions, "strategy">>(
    () => ({
      wr: plan.swr,
      horizonYears: inputs.horizonYears,
      equity: simOptions.equity,
      feeAnnual: simOptions.feeAnnual,
      capeA: inputs.capeA,
      capeB: inputs.capeB,
    }),
    [plan.swr, inputs.horizonYears, inputs.capeA, inputs.capeB, simOptions.equity, simOptions.feeAnnual],
  )

  const summaries = useMemo(
    () => (history ? STRATEGIES.map((s) => summarizeStrategy(history, { ...base, strategy: s.key })) : []),
    [history, base],
  )

  const rows = useMemo<Row[]>(() => {
    if (!history) return []
    const start = history.months.indexOf(cohort)
    if (start < 0) return []
    const years = Math.min(base.horizonYears, Math.floor((history.months.length - start) / 12))
    const paths = STRATEGIES.map((s) => [s.key, simulateStrategy(history, start, { ...base, horizonYears: years, strategy: s.key }).spending] as const)
    return Array.from({ length: years }, (_, y) => {
      const row: Row = { year: y + 1 }
      for (const [key, spending] of paths) row[key as StrategyKey] = spending[y] * plan.annualSpend
      return row
    })
  }, [history, cohort, base, plan.annualSpend])

  if (!history) return null

  return (
    <FireSectionCard
      eyebrow="Withdrawal strategies"
      title={`Your spending year by year if you'd retired in ${fmtMonth(cohort)}`}
      info="Each rule sets spending at the start of every retirement year (real dollars, your allocation, historical returns). Fixed dollars keeps spending steady but can run out; the others never run out but let spending fall. Guardrails are ERN's critique target (SWR Parts 9–10); the CAPE rule is his preferred adaptive rule (Part 54). Portfolio only: Social Security and one-time amounts are left out here."
      right={
        <ChoiceChips
          label="Retirement start"
          options={COHORTS.map((c) => ({ value: c, label: c.slice(0, 4) }))}
          value={cohort}
          onChange={setCohort}
        />
      }
    >
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => `yr ${v}`} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={52} />
            <Tooltip formatter={(v?: number) => fmtMoney(v ?? null)} labelFormatter={(y) => `Year ${y}`} contentStyle={{ fontSize: 11 }} />
            <ReferenceLine y={plan.annualSpend} stroke={warning} strokeDasharray="4 4" label={{ value: "Planned", position: "insideTopLeft", fontSize: 10, fill: warning }} />
            {STRATEGIES.map((s, i) => (
              <Line key={s.key} type="stepAfter" dataKey={s.key} name={s.label} stroke={palette[i]} strokeWidth={1.75} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-card-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-card-elevated text-[10px] uppercase tracking-wider text-foreground-muted">
              <th className="text-left font-semibold px-3 py-2">Rule · all retirements since 1871</th>
              <th className="text-right font-semibold px-3 py-2">Never ran out</th>
              <th className="text-right font-semibold px-3 py-2">Bad-case low year</th>
              <th className="text-right font-semibold px-3 py-2">Typical year</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGIES.map((s, i) => {
              const sum = summaries[i]
              return (
                <tr key={s.key} className="border-t border-card-border/50" title={s.description}>
                  <td className="px-3 py-2 text-foreground">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: palette[i] }} />
                    {s.label}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{fmtSuccess(sum?.successRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    <BlurredValue isHidden={isHidden}>{sum ? fmtMoney(sum.lowSpend * plan.annualSpend) : "—"}</BlurredValue>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">
                    <BlurredValue isHidden={isHidden}>{sum ? fmtMoney(sum.typicalSpend * plan.annualSpend) : "—"}</BlurredValue>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-muted mt-2">
        &quot;Bad-case low year&quot; = the lowest spending year in the worst 10% of retirements. Fixed dollars shows your plan until it runs out.
      </p>
    </FireSectionCard>
  )
}
