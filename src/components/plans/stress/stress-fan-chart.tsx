"use client"

import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const HEIGHT = 320

interface FanRow {
  age: number
  outer: [number, number]
  inner: [number, number]
  median: number
  plan: number
  worst: number | null
}

function FanTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FanRow }> }) {
  const r = payload?.[0]?.payload
  if (!active || !r) return null
  const line = (label: string, value: number, muted = true) => (
    <p className={`flex justify-between gap-4 ${muted ? "text-foreground-muted" : "text-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmtMoney(value)}</span>
    </p>
  )
  return (
    <div className="w-60 space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">Age {r.age}</p>
      {line("Good case (90th pct)", r.outer[1])}
      {line("75th pct", r.inner[1])}
      {line("Median", r.median, false)}
      {line("25th pct", r.inner[0])}
      {line("Bad case (10th pct)", r.outer[0])}
      <div className="border-t border-card-border pt-0.5">{line("Your plan (steady returns)", r.plan)}</div>
      {r.worst !== null && line("Worst start year", r.worst)}
    </div>
  )
}

interface Props {
  bands: number[][]
  age0: number
  /** The steady-return plan, same measure, today's dollars. */
  plan: number[]
  worst: CohortResult | null
  measure: "netWorth" | "invested"
  isHidden: boolean
}

/** The spread of outcomes by age across every historical period: 10–90 and 25–75 percentile bands and the median. */
export function StressFanChart({ bands, age0, plan, worst, measure, isHidden }: Props) {
  const { primary, error, foreground, foregroundMuted, border } = useChartTheme()
  const axisWidth = useIsNarrow() ? NARROW_AXIS_WIDTH : 56
  const data = useMemo<FanRow[]>(
    () =>
      bands.map(([p10, p25, p50, p75, p90], i) => ({
        age: age0 + i,
        outer: [p10, p90],
        inner: [p25, p75],
        median: p50,
        plan: plan[i] ?? 0,
        worst: worst ? worst[measure][i] ?? null : null,
      })),
    [bands, age0, plan, worst, measure],
  )
  return (
    <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={axisWidth} />
          <Tooltip content={<FanTooltip />} />
          <Area dataKey="outer" stroke="none" fill={primary} fillOpacity={0.12} isAnimationActive={false} />
          <Area dataKey="inner" stroke="none" fill={primary} fillOpacity={0.22} isAnimationActive={false} />
          <Line dataKey="median" stroke={primary} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="plan" stroke={foreground} strokeOpacity={0.6} strokeDasharray="5 4" strokeWidth={1.25} dot={false} isAnimationActive={false} />
          {worst && <Line dataKey="worst" stroke={error} strokeWidth={1} strokeOpacity={0.8} dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
