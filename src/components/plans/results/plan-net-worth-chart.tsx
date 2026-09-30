"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import {
  chartMilestones,
  NET_WORTH_LAYER_LABELS,
  NET_WORTH_LAYERS,
  netWorthPoints,
  type ChartMilestone,
  type NetWorthLayer,
} from "@/lib/plans/plan-chart"
import type { DollarBasis, PlanDocument, PlanProjection, YearRow } from "@/lib/plans/plan-types"
import { yearMetrics } from "@/lib/plans/plan-year-metrics"
import { PlanYearPanel } from "./plan-year-panel"

const DIMMED = 0.35
const Y_HEADROOM = 1.03
/** Space above the plot for milestone icons. */
const ICON_ROW = 30
const MILESTONE_ICONS: Record<ChartMilestone["kind"], string> = {
  retirement: "beach_access",
  custom: "flag",
  depleted: "warning",
}

/** Small round icon at the top of a milestone's line; hover shows its name. */
function MilestoneMarker({ viewBox, mark, color }: { viewBox?: { x: number; y: number }; mark: ChartMilestone; color: string }) {
  if (!viewBox) return null
  const cx = viewBox.x
  const cy = viewBox.y - ICON_ROW / 2
  return (
    <g style={{ cursor: "default" }}>
      <title>{`${mark.name} · age ${mark.age} (${mark.year})`}</title>
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
        {MILESTONE_ICONS[mark.kind]}
      </text>
    </g>
  )
}

interface Props {
  doc: PlanDocument
  projection: PlanProjection
  rows: YearRow[]
  basis: DollarBasis
  isHidden: boolean
}

/** Year-end net worth as stacked bars by tax treatment, real-asset equity and debt; click a bar for that year. */
export function PlanNetWorthChart({ doc, projection, rows, basis, isHidden }: Props) {
  const { primary, palette, error, foregroundMuted, border, warning, success, foreground } = useChartTheme()
  const points = useMemo(() => netWorthPoints(doc, rows), [doc, rows])
  const marks = useMemo(() => chartMilestones(doc, projection), [doc, projection])
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const colors: Record<NetWorthLayer | "debt", string> = {
    cash: palette[2] ?? success,
    taxable: primary,
    taxDeferred: palette[1] ?? warning,
    taxFree: palette[3] ?? primary,
    realAssetEquity: foregroundMuted,
    debt: error,
  }
  const shownLayers = NET_WORTH_LAYERS.filter((k) => points.some((p) => p[k] > 0.5))
  const hasDebt = points.some((p) => p.debt < -0.5)
  // Fit the axis to the data so the tallest bar nearly fills the plot.
  const yDomain = useMemo(() => {
    const top = Math.max(0, ...points.map((p) => NET_WORTH_LAYERS.reduce((s, k) => s + Math.max(0, p[k]), 0)))
    const bottom = Math.min(0, ...points.map((p) => p.debt))
    return [bottom * Y_HEADROOM, top * Y_HEADROOM] as [number, number]
  }, [points])
  const active = selected ?? hovered ?? 0
  const activePoint = points[active] ?? null
  const metrics = useMemo(
    () => yearMetrics(doc, rows, active, projection.startNetWorth),
    [doc, rows, active, projection.startNetWorth],
  )
  const indexOf = (state: { activeTooltipIndex?: unknown } | null | undefined) => {
    const index = Number(state?.activeTooltipIndex)
    return Number.isInteger(index) && index >= 0 ? index : null
  }

  const bars = (key: NetWorthLayer | "debt") => (
    <Bar key={key} dataKey={key} stackId="nw" fill={colors[key]} isAnimationActive={false} cursor="pointer">
      {points.map((_, i) => (
        <Cell key={i} fillOpacity={selected === null || selected === i ? 0.85 : DIMMED} />
      ))}
    </Bar>
  )

  return (
    <FireSectionCard
      eyebrow="Net worth"
      title={basis === "today" ? "In today's dollars" : "In future dollars"}
      info="Year-end balances by tax treatment. Real-asset equity is what your home and other assets are worth minus the loans on them; other debt shows below zero. Hover a bar to see that year; click to pin it."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          <div className="h-[340px] lg:h-[500px]" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: ICON_ROW, right: 12, left: 4, bottom: 0 }}
                stackOffset="sign"
                barCategoryGap="8%"
                onMouseMove={(state) => setHovered(indexOf(state))}
                onMouseLeave={() => setHovered(null)}
                onClick={(state) => {
                  const index = indexOf(state)
                  if (index !== null) setSelected(index === selected ? null : index)
                }}
              >
                <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 10, fill: foregroundMuted }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  domain={yDomain}
                  allowDataOverflow
                  tick={{ fontSize: 10, fill: foregroundMuted }}
                  tickFormatter={fmtCompact}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={() => null} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
                <ReferenceLine y={0} stroke={border} />
                {shownLayers.map(bars)}
                {hasDebt && bars("debt")}
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke={foreground}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {marks.map((m) => (
                  <ReferenceLine
                    key={`${m.name}-${m.age}`}
                    x={m.age}
                    stroke={m.kind === "depleted" ? error : foregroundMuted}
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={<MilestoneMarker mark={m} color={m.kind === "depleted" ? error : primary} />}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {[...shownLayers, ...(hasDebt ? (["debt"] as const) : [])].map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: colors[k] }} />
                {NET_WORTH_LAYER_LABELS[k]}
              </span>
            ))}
            {marks.map((m) => (
              <span
                key={`legend-${m.name}-${m.age}`}
                className="inline-flex items-center gap-1 text-[11px] text-foreground-muted"
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: 13, color: m.kind === "depleted" ? error : primary }}
                >
                  {MILESTONE_ICONS[m.kind]}
                </span>
                {m.name} ({m.age})
              </span>
            ))}
          </div>
        </div>
        {metrics && activePoint && (
          <div className="lg:sticky lg:top-4" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
            <PlanYearPanel
              metrics={metrics}
              age={activePoint.age}
              year={activePoint.year}
              pinned={selected !== null}
              onUnpin={() => setSelected(null)}
              colors={{ cash: colors.cash, taxable: colors.taxable, taxDeferred: colors.taxDeferred, taxFree: colors.taxFree }}
            />
          </div>
        )}
      </div>
    </FireSectionCard>
  )
}
