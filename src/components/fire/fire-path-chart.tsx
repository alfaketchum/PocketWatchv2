"use client"

import { useMemo, useState } from "react"
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { projectPath } from "@/lib/fire/fire-projection"
import { windfallsFor } from "@/lib/fire/fire-analysis"
import { nowFractionalYear } from "@/lib/fire/fire-history"
import { fmtCompact, fmtMoney, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

type View = "nest" | "monthly" | "fi"

interface Point {
  x: number
  actual?: number
  projected?: number
}

const VIEWS: { value: View; label: string; advancedOnly?: boolean }[] = [
  { value: "nest", label: "Nest egg" },
  { value: "monthly", label: "Monthly" },
  { value: "fi", label: "FI %", advancedOnly: true },
]

/** Years past the FI date to keep projecting, so the crossing sits inside the chart. */
const YEARS_AFTER_FI = 3
const UNREACHABLE_SPAN = 25

function PathTooltip({ active, payload, format }: { active?: boolean; payload?: Array<{ payload: Point }>; format: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const value = p.actual ?? p.projected
  if (value === undefined) return null
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-foreground-muted">{Math.floor(p.x)} · {p.actual !== undefined ? "actual" : "projected"}</p>
      <p className="font-semibold text-foreground tabular-nums">{format(value)}</p>
    </div>
  )
}

/** Your path to FI: actual history (solid) joined to the projection (dashed), in three lenses. */
export function FirePathChart({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const [view, setView] = useState<View>("nest")
  const { analysis, plan, inputs, actualHistory } = state
  const { primary, foregroundMuted, border, warning, success } = useChartTheme()
  const advanced = inputs.mode === "advanced"
  const active = !advanced && view === "fi" ? "nest" : view

  const transform = useMemo(() => {
    if (active === "monthly") return (v: number) => (v * plan.swr) / 12
    if (active === "fi") return (v: number) => (analysis.fireNumber > 0 ? v / analysis.fireNumber : 0)
    return (v: number) => v
  }, [active, plan.swr, analysis.fireNumber])

  const format = active === "fi" ? (v: number) => fmtPct(v, 0) : active === "monthly" ? (v: number) => `${fmtMoney(v)}/mo` : fmtMoney
  const target = active === "monthly" ? plan.annualSpend / 12 : active === "fi" ? 1 : analysis.fireNumber
  const targetLabel = active === "monthly" ? `Spending ${fmtMoney(plan.annualSpend / 12)}/mo` : active === "fi" ? "100% FI" : "FIRE number"

  const { data, fiX } = useMemo(() => {
    const now = nowFractionalYear(new Date())
    const years = analysis.yourTarget.years
    const span = years === null ? UNREACHABLE_SPAN : Math.max(YEARS_AFTER_FI, Math.ceil(years) + YEARS_AFTER_FI)
    const projection = projectPath(plan.investable, plan.annualContribution, inputs.realReturn, inputs.currentAge, span, 0, windfallsFor(inputs))
    const points: Point[] = [
      ...actualHistory.filter((p) => p.x < now).map((p) => ({ x: p.x, actual: transform(p.value) })),
      { x: now, actual: transform(plan.investable), projected: transform(plan.investable) },
      ...projection.slice(1).map((p, i) => ({ x: now + i + 1, projected: transform(p.value) })),
    ]
    return { data: points, fiX: years !== null && years > 0 ? now + years : null }
  }, [actualHistory, plan, inputs, analysis.yourTarget.years, transform])

  const views = VIEWS.filter((v) => advanced || !v.advancedOnly)

  return (
    <FireSectionCard
      eyebrow="Your path"
      title={active === "monthly" ? "When your portfolio can pay your bills" : "Where your investments are headed"}
      info={`Solid = your actual invested assets. Dashed = projected at ${fmtPct(inputs.realReturn, 1)} real return plus ${fmtMoney(plan.annualContribution)}/yr, in today's dollars. Monthly = what ${fmtPct(plan.swr, 2)} of your portfolio pays each month.`}
      right={
        <div role="radiogroup" aria-label="Chart view" className="inline-flex rounded-lg border border-card-border p-0.5">
          {views.map((v) => (
            <button
              key={v.value}
              type="button"
              role="radio"
              aria-checked={active === v.value}
              onClick={() => setView(v.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                active === v.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      }
    >
      <div style={{ filter: isHidden && active !== "fi" ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => String(Math.floor(v))} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={active === "fi" ? (v: number) => fmtPct(v, 0) : fmtCompact} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<PathTooltip format={format} />} />
            <ReferenceLine y={target} stroke={warning} strokeOpacity={0.9} label={{ value: targetLabel, position: "insideTopLeft", fontSize: 10, fill: warning }} />
            {fiX !== null && (
              <ReferenceDot x={fiX} y={target} r={4} fill={success} stroke="none" label={{ value: `FI ${Math.floor(fiX)}`, position: "top", fontSize: 10, fill: success }} />
            )}
            <Line type="monotone" dataKey="actual" stroke={primary} strokeWidth={2} dot={false} connectNulls={false} animationDuration={500} />
            <Line type="monotone" dataKey="projected" stroke={primary} strokeWidth={2} strokeDasharray="5 4" strokeOpacity={0.7} dot={false} connectNulls={false} animationDuration={500} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </FireSectionCard>
  )
}
