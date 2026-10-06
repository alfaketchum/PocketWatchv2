"use client"

import { memo } from "react"
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import { DIMMED } from "../results/plan-chart-plot"
import type { ChartMode, ChartRow, Series } from "../results/use-chart-series"
import { tone } from "./compare-helpers"

interface Props {
  rows: ChartRow[]
  series: Series[]
  mode: ChartMode
  /** Stack each band's difference instead of one bar for the total. */
  breakdown: boolean
  selected: number | null
  onHover: (index: number | null) => void
  onSelect: (index: number) => void
  /** Shared with the A and B charts, so a hovered year shows in all three. */
  syncId: string
}

const indexOf = (state: { activeTooltipIndex?: unknown } | null | undefined) => {
  const index = Number(state?.activeTooltipIndex)
  return Number.isInteger(index) && index >= 0 ? index : null
}

/**
 * B minus A each year: one bar for the total, green where B comes out ahead and red where it falls behind, or each
 * band's difference stacked with the total as dots. Years only one plan runs stay empty.
 */
export const CompareDiffChart = memo(function CompareDiffChart({ rows, series, mode, breakdown, selected, onHover, onSelect, syncId }: Props) {
  const { success, error, foreground, foregroundMuted, border } = useChartTheme()
  const axisWidth = useIsNarrow() ? NARROW_AXIS_WIDTH : 56
  const toneColor = (v: number) => {
    const t = tone(mode, v)
    return t > 0 ? success : t < 0 ? error : foregroundMuted
  }
  const opacity = (i: number) => (selected === null || selected === i ? 0.85 : DIMMED)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={rows}
        syncId={syncId}
        margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
        stackOffset="sign"
        barCategoryGap="8%"
        onMouseMove={(state) => onHover(indexOf(state))}
        onMouseLeave={() => onHover(null)}
        onClick={(state) => {
          const index = indexOf(state)
          if (index !== null) onSelect(index)
        }}
      >
        <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
        <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={axisWidth} />
        {/* The year card beside the chart shows the numbers; the tooltip only draws the hover band. */}
        <Tooltip content={() => null} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
        <ReferenceLine y={0} stroke={foregroundMuted} />
        {breakdown ? (
          series.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="diff" fill={s.color} isAnimationActive={false} cursor="pointer">
              {rows.map((_, i) => (
                <Cell key={i} fillOpacity={opacity(i)} />
              ))}
            </Bar>
          ))
        ) : (
          <Bar dataKey="total" isAnimationActive={false} cursor="pointer">
            {rows.map((r, i) => (
              <Cell key={i} fill={toneColor(r.total ?? 0)} fillOpacity={opacity(i)} />
            ))}
          </Bar>
        )}
        {breakdown && mode !== "cashflow" && (
          <Line dataKey="total" stroke="none" dot={{ r: 2.5, fill: foreground, stroke: "none" }} activeDot={false} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
})
