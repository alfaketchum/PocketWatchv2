"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtMoney } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: { age: number; year: number; value: number } }>
}

function ProjectionTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-foreground-muted">Age {Math.round(p.age)} · {p.year}</p>
      <p className="font-semibold text-foreground tabular-nums">{fmtMoney(p.value)}</p>
    </div>
  )
}

/** Projected invested assets (today's dollars) with each FIRE tier as a horizontal target. */
export function FireProjectionChart({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { analysis, inputs } = state
  const { primary, foregroundMuted, border, warning, success } = useChartTheme()

  const lines = useMemo(() => {
    const maxValue = analysis.projection[analysis.projection.length - 1]?.value ?? 0
    const tiers = analysis.tiers
      .filter((t) => t.target <= maxValue * 1.15)
      .map((t) => ({ key: t.tier.key, label: t.tier.label, value: t.target }))
    return [...tiers, { key: "you", label: "Your FIRE number", value: analysis.fireNumber }]
  }, [analysis])

  const fiAge = analysis.yourTarget.age

  return (
    <FireSectionCard
      eyebrow="Projection"
      title="Your path to financial independence"
      info={`Invested assets growing at a ${(inputs.realReturn * 100).toFixed(1)}% real return plus your yearly contributions, in today's dollars.`}
    >
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={analysis.projection} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="fireProjectionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis
              dataKey="age"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10, fill: foregroundMuted }}
              tickFormatter={(v: number) => `${Math.round(v)}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: foregroundMuted }}
              tickFormatter={fmtCompact}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<ProjectionTooltip />} />
            {lines.map((l) => (
              <ReferenceLine
                key={l.key}
                y={l.value}
                stroke={l.key === "you" ? warning : foregroundMuted}
                strokeDasharray={l.key === "you" ? undefined : "4 4"}
                strokeOpacity={l.key === "you" ? 0.9 : 0.5}
                label={{ value: l.label, position: "insideTopLeft", fontSize: 10, fill: l.key === "you" ? warning : foregroundMuted }}
              />
            ))}
            {fiAge !== null && fiAge > inputs.currentAge && (
              <ReferenceLine
                x={fiAge}
                stroke={success}
                strokeDasharray="2 3"
                label={{ value: `FI at ${Math.floor(fiAge)}`, position: "insideTopRight", fontSize: 10, fill: success }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={primary}
              strokeWidth={2}
              fill="url(#fireProjectionFill)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </FireSectionCard>
  )
}
