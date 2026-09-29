"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { growthSplit } from "@/lib/fire/fire-growth"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtMoney } from "./fire-helpers"

/** Years past FI to keep showing, so the flywheel after FI is visible. */
const YEARS_AFTER_FI = 3
const UNREACHABLE_SPAN = 20

/** "The flywheel": what you invest each year vs what the market adds. */
export function FireGrowthChart({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { plan, inputs, analysis } = state
  const { primary, success, foregroundMuted, border } = useChartTheme()

  const split = useMemo(() => {
    const years = analysis.yourTarget.years
    const span = years === null ? UNREACHABLE_SPAN : Math.max(YEARS_AFTER_FI + 1, Math.ceil(years) + YEARS_AFTER_FI)
    return growthSplit(plan.investable, plan.annualContribution, inputs.realReturn, analysis.fireNumber, span, new Date().getFullYear())
  }, [plan.investable, plan.annualContribution, inputs.realReturn, analysis.fireNumber, analysis.yourTarget.years])

  const now = new Date().getFullYear()
  const headline =
    split.crossoverYear === null
      ? "Your contributions still do most of the work."
      : split.crossoverYear <= now
        ? "The market already adds more each year than you invest."
        : `From ${split.crossoverYear}, the market adds more each year than you invest.`

  return (
    <div>
      <p className="text-sm text-foreground mb-3">{headline}</p>
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={split.years} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={52} />
            <Tooltip formatter={(v?: number) => fmtMoney(v ?? null)} contentStyle={{ fontSize: 11 }} cursor={{ fill: `${primary}10` }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            {split.crossoverYear !== null && split.crossoverYear > now && (
              <ReferenceLine x={split.crossoverYear} stroke={success} strokeDasharray="3 3" />
            )}
            <Bar dataKey="contributed" name="You invest" stackId="g" fill={primary} radius={[0, 0, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="market" name="Market adds" stackId="g" fill={success} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
