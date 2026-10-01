"use client"

import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { DANGER_YEARS } from "@/lib/plans/stress/stress-close-calls"
import { cushionBands } from "@/lib/plans/stress/stress-cushion"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const HEIGHT = 280
/** Cushions are drawn up to this many years; above it reads "25+". */
const CAP = 25

interface CushionRow {
  age: number
  outer: [number, number] | null
  inner: [number, number] | null
  median: number | null
  plan: number | null
  worst: number | null
  /** Unclipped values for the tooltip. */
  raw: { p10: number; p50: number; p90: number; plan: number | null; worst: number | null } | null
}

const clip = (v: number | null | undefined) => (v == null ? null : Math.min(v, CAP))
const yrs = (v: number) => (v >= CAP ? `${CAP}+ yrs` : `${v.toFixed(1)} yrs`)

function CushionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CushionRow }> }) {
  const r = payload?.[0]?.payload
  if (!active || !r?.raw) return null
  const line = (label: string, value: number | null, muted = true) =>
    value !== null && (
      <p className={`flex justify-between gap-4 ${muted ? "text-foreground-muted" : "text-foreground"}`}>
        <span>{label}</span>
        <span className="tabular-nums">{yrs(value)}</span>
      </p>
    )
  return (
    <div className="w-60 space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">Age {r.age}: years of spending in your accounts</p>
      {line("Good case (90th pct)", r.raw.p90)}
      {line("Median", r.raw.p50, false)}
      {line("Bad case (10th pct)", r.raw.p10)}
      <div className="border-t border-card-border pt-0.5">{line("Your plan (steady returns)", r.raw.plan)}</div>
      {line("Worst start year", r.raw.worst)}
    </div>
  )
}

interface Props {
  cohorts: CohortResult[]
  age0: number
  /** The steady-return plan's cushion by year. */
  plan: (number | null)[]
  worst: CohortResult | null
  isHidden: boolean
}

/** Years of spending in your accounts by age across every period, with the danger zone (under 3 years) shaded. */
export function StressCushionChart({ cohorts, age0, plan, worst, isHidden }: Props) {
  const { primary, error, foreground, foregroundMuted, border } = useChartTheme()
  const data = useMemo<CushionRow[]>(() => {
    const bands = cushionBands(cohorts.map((c) => c.cushion ?? []))
    return bands.map((b, i) => {
      const w = worst?.cushion?.[i] ?? null
      return {
        age: age0 + i,
        outer: b ? [clip(b[0])!, clip(b[4])!] : null,
        inner: b ? [clip(b[1])!, clip(b[3])!] : null,
        median: b ? clip(b[2]) : null,
        plan: clip(plan[i]),
        worst: b ? clip(w) : null,
        raw: b ? { p10: b[0], p50: b[2], p90: b[4], plan: plan[i] ?? null, worst: w } : null,
      }
    })
  }, [cohorts, age0, plan, worst])
  if (!data.some((r) => r.raw)) {
    return <p className="text-sm text-foreground-muted">In most periods your income pays the bills the whole way, so there&apos;s no cushion to chart.</p>
  }
  return (
    <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis
            domain={[0, CAP]}
            ticks={[0, DANGER_YEARS, 10, 15, 20, CAP]}
            tickFormatter={(v: number) => (v >= CAP ? `${CAP}+` : `${v}`)}
            tick={{ fontSize: 10, fill: foregroundMuted }}
            tickLine={false}
            axisLine={false}
            width={36}
            label={{ value: "years", angle: -90, position: "insideLeft", fontSize: 10, fill: foregroundMuted }}
          />
          <ReferenceArea y1={0} y2={DANGER_YEARS} fill={error} fillOpacity={0.12} stroke="none" ifOverflow="hidden" />
          <ReferenceLine
            y={DANGER_YEARS}
            stroke={error}
            strokeOpacity={0.6}
            strokeDasharray="4 3"
            label={{ value: "Danger zone", position: "insideBottomRight", fontSize: 10, fill: error }}
          />
          <Tooltip content={<CushionTooltip />} />
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
