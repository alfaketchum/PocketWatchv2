"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import { fmtCompact } from "@/components/fire/fire-helpers"
import type { LoanOutcome } from "@/lib/plans/plan-loan-compare"
import { optionLabel } from "@/lib/plans/plan-loan-options"

type Row = { year: number } & Record<string, number>

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${fmtCompact(Math.abs(v))}`

/** Net worth of each option minus the plan as it is, year by year (today's dollars). */
export function LoanDifferenceChart({ planned, shown, colors, isHidden }: { planned: LoanOutcome; shown: LoanOutcome[]; colors: string[]; isHidden: boolean }) {
  const { foregroundMuted, border, foreground } = useChartTheme()
  const axisWidth = useIsNarrow() ? NARROW_AXIS_WIDTH : 60
  const rows = useMemo(
    () =>
      planned.years.map((year, i) => {
        const row: Row = { year } as Row
        shown.forEach((o, k) => (row[`o${k}`] = (o.netWorth[i] ?? 0) - (planned.netWorth[i] ?? 0)))
        return row
      }),
    [planned, shown],
  )
  return (
    <div>
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={signed} axisLine={false} tickLine={false} width={axisWidth} />
            <ReferenceLine y={0} stroke={foreground} strokeOpacity={0.4} strokeDasharray="4 4" />
            <Tooltip
              formatter={(value, key) => [signed(Number(value)), optionLabel(shown[Number(String(key).slice(1))].option)]}
              labelFormatter={(year) => `${year} vs as planned`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            {shown.map((_, k) => (
              <Line key={k} type="monotone" dataKey={`o${k}`} stroke={colors[k]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-foreground-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-3 border-t border-dashed" style={{ borderColor: foreground }} />
          As planned
        </span>
        {shown.map((o, k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors[k] }} />
            {optionLabel(o.option)}
          </span>
        ))}
      </div>
    </div>
  )
}
