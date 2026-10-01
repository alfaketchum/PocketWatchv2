"use client"

import { memo, useMemo, type SyntheticEvent } from "react"
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { fmtCompact } from "@/components/fire/fire-helpers"
import type { ChartMilestone } from "@/lib/plans/plan-chart"
import { PlanBarTooltip } from "./plan-bar-tooltip"
import type { ChartMode, ChartRow, Series } from "./use-chart-series"

export const DIMMED = 0.35
/** Space above the plot for milestone icons. */
export const ICON_ROW = 30
/** Vertical distance between icons that share a year. */
export const ICON_STACK = 22

export const MILESTONE_ICONS: Record<ChartMilestone["kind"], string> = {
  retirement: "beach_access",
  custom: "flag",
  child: "child_care",
  asset: "home",
  income: "payments",
  payoff: "credit_score",
  depleted: "warning",
}

export interface HoveredMark {
  mark: ChartMilestone
  x: number
  y: number
}

/** Small round icon at the top of a milestone's line; hovering it shows a card with details. */
function MilestoneMarker({
  viewBox,
  mark,
  color,
  level,
  onHover,
}: {
  viewBox?: { x: number; y: number }
  mark: ChartMilestone
  color: string
  level: number
  onHover: (hovered: HoveredMark | null) => void
}) {
  if (!viewBox) return null
  const cx = viewBox.x
  const cy = viewBox.y - ICON_ROW / 2 - level * ICON_STACK
  return (
    <g
      style={{ cursor: "help", pointerEvents: "all" }}
      onMouseEnter={() => onHover({ mark, x: cx, y: cy })}
      onMouseLeave={() => onHover(null)}
    >
      <circle cx={cx} cy={cy} r={10} fill={color} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={13}
        fontFamily="Material Symbols Rounded"
      >
        {mark.icon ?? MILESTONE_ICONS[mark.kind]}
      </text>
    </g>
  )
}

/**
 * Whether a click landed on a bar rather than empty chart space. Checks everything under the pointer, as the
 * hover highlight can sit on top of the bar it highlights.
 */
function onBar(event: SyntheticEvent): boolean {
  const { clientX, clientY } = event.nativeEvent as MouseEvent
  if (typeof document === "undefined" || clientX === undefined) return true
  return document.elementsFromPoint(clientX, clientY).some((el) => el.closest(".recharts-bar-rectangle"))
}

const indexOf = (state: { activeTooltipIndex?: unknown } | null | undefined) => {
  const index = Number(state?.activeTooltipIndex)
  return Number.isInteger(index) && index >= 0 ? index : null
}

interface ChartPlotProps {
  points: ChartRow[]
  series: Series[]
  yAxis: { domain: [number, number]; ticks: number[] }
  iconRoom: number
  stacked: { mark: ChartMilestone; level: number }[]
  mode: ChartMode
  hasDebt: boolean
  /** Draw the dashed all-steady spending line (Expenses view) */
  showSteady: boolean
  selected: number | null
  markColor: (m: ChartMilestone) => string
  onHover: (index: number | null) => void
  /** A bar was clicked (its year). */
  onSelect: (index: number) => void
  /** The chart was clicked off the bars: empty space unpins. */
  onClear: () => void
  onHoverMark: (hovered: HoveredMark | null) => void
  /** The year view: one wide bar with each part labelled. */
  focused: boolean
}

/** A part's label inside the year view's bar, when it's tall enough to read: "Taxable $1.2M". */
const MIN_LABEL_SHARE = 0.05
function partLabel(label: string, span: number) {
  return (value: unknown) => {
    const v = Number(value)
    return Number.isFinite(v) && Math.abs(v) >= span * MIN_LABEL_SHARE ? `${label} ${fmtCompact(v)}` : ""
  }
}

/**
 * The plot itself, memoized: hovering (which only changes the side panel and hover cards) must not
 * redraw hundreds of bar segments. It re-renders only when its data, selection or theme changes.
 */
export const ChartPlot = memo(function ChartPlot({
  points,
  series,
  yAxis,
  iconRoom,
  stacked,
  mode,
  hasDebt,
  showSteady,
  selected,
  markColor,
  onHover,
  onSelect,
  onClear,
  onHoverMark,
  focused,
}: ChartPlotProps) {
  const { error, foregroundMuted, border, foreground } = useChartTheme()
  const barTops = useMemo(
    () => new Map(points.map((p) => [p.age, series.reduce((sum, s) => sum + Math.max(0, p[s.key] ?? 0), 0)])),
    [points, series],
  )
  const span = yAxis.domain[1] - yAxis.domain[0]
  const bars = ({ key, color, label }: Series) => (
    <Bar key={key} dataKey={key} stackId="stack" fill={color} isAnimationActive={false} cursor="pointer">
      {points.map((_, i) => (
        <Cell key={i} fillOpacity={focused || selected === null || selected === i ? 0.85 : DIMMED} />
      ))}
      {focused && <LabelList dataKey={key} position="center" formatter={partLabel(label, span)} fill="#fff" fontSize={11} fontWeight={600} />}
    </Bar>
  )
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={points}
        margin={{ top: iconRoom, right: 12, left: 4, bottom: 0 }}
        stackOffset="sign"
        barCategoryGap={focused ? "30%" : "8%"}
        onMouseMove={(state) => onHover(indexOf(state))}
        onMouseLeave={() => onHover(null)}
        onClick={(state, event) => {
          const index = indexOf(state)
          if (index !== null && onBar(event)) onSelect(index)
          else onClear()
        }}
      >
        <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
        <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis
          domain={yAxis.domain}
          ticks={yAxis.ticks}
          allowDataOverflow
          tick={{ fontSize: 10, fill: foregroundMuted }}
          tickFormatter={fmtCompact}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        {mode === "debt" && (
          <YAxis
            yAxisId="owed"
            orientation="right"
            tick={{ fontSize: 10, fill: foregroundMuted }}
            tickFormatter={fmtCompact}
            axisLine={false}
            tickLine={false}
            width={56}
          />
        )}
        <Tooltip
          content={<PlanBarTooltip series={series} mode={mode} />}
          cursor={{ fill: foreground, fillOpacity: 0.06 }}
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
        />
        <ReferenceLine y={0} stroke={border} />
        {series.map(bars)}
        {/* Net worth only differs from the bar tops when there's debt; mark it with a light dot then. */}
        {mode === "networth" && hasDebt && (
          <Line
            dataKey="netWorth"
            stroke="none"
            dot={{ r: 2.5, fill: foregroundMuted, stroke: "none" }}
            activeDot={false}
            isAnimationActive={false}
          />
        )}
        {mode === "debt" && (
          <Line yAxisId="owed" dataKey="owedLine" stroke={foreground} strokeOpacity={0.5} strokeDasharray="4 3" strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />
        )}
        {showSteady && (
          <Line dataKey="steady" stroke={foreground} strokeOpacity={0.55} strokeDasharray="5 4" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
        )}
        {/* Each milestone's line drops from its icon to the top of that year's bar, not through it. */}
        {stacked.map(({ mark: m, level }) => (
          <ReferenceLine
            key={`${m.name}-${m.age}`}
            segment={[{ x: m.age, y: barTops.get(m.age) ?? 0 }, { x: m.age, y: yAxis.domain[1] }]}
            stroke={m.kind === "depleted" ? error : foregroundMuted}
            strokeDasharray="2 3"
            strokeWidth={0.75}
            strokeOpacity={0.5}
            label={<MilestoneMarker mark={m} level={level} color={markColor(m)} onHover={onHoverMark} />}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
})

