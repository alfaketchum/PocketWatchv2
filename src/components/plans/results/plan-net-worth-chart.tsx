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
import { cn } from "@/lib/utils"
import {
  CASH_FLOW_LABELS,
  CASH_IN_LAYERS,
  CASH_OUT_LAYERS,
  cashFlowPoints,
  chartMilestones,
  NET_WORTH_LAYER_LABELS,
  NET_WORTH_LAYERS,
  netWorthPoints,
  type ChartMilestone,
} from "@/lib/plans/plan-chart"
import type { DollarBasis, PlanDocument, PlanProjection, YearRow } from "@/lib/plans/plan-types"
import { milestoneUses } from "@/lib/plans/plan-milestone-uses"
import { yearMetrics } from "@/lib/plans/plan-year-metrics"
import { PlanYearPanel } from "./plan-year-panel"
import { usePlanColors } from "./use-plan-colors"

const DIMMED = 0.35
const Y_HEADROOM = 1.03
/** Space above the plot for milestone icons. */
const ICON_ROW = 30
/** Vertical distance between icons that share a year. */
const ICON_STACK = 22

/** Stack position of each milestone among those in the same year (0 = lowest). */
function stackMarks(marks: ChartMilestone[]): { mark: ChartMilestone; level: number }[] {
  const seen = new Map<number, number>()
  return marks.map((mark) => {
    const level = seen.get(mark.age) ?? 0
    seen.set(mark.age, level + 1)
    return { mark, level }
  })
}
const MILESTONE_ICONS: Record<ChartMilestone["kind"], string> = {
  retirement: "beach_access",
  custom: "flag",
  child: "child_care",
  asset: "home",
  depleted: "warning",
}

interface HoveredMark {
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

type ChartMode = "networth" | "cashflow"

const MODES: { value: ChartMode; label: string }[] = [
  { value: "networth", label: "Net worth" },
  { value: "cashflow", label: "Cash flow" },
]

interface Series {
  key: string
  label: string
  color: string
}

type ChartRow = { age: number; year: number } & Record<string, number>

function ModeToggle({ value, onChange }: { value: ChartMode; onChange: (mode: ChartMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Chart view" className="inline-flex rounded-lg border border-card-border p-0.5">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === m.value ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

const TICK_INTERVALS = 6

/** 1, 2, 2.5 or 5 × a power of ten: a round step near `raw`. */
function roundStep(raw: number): number {
  if (raw <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10
  return step * magnitude
}

/** Round ticks that hug the stacked bars, so the tallest one nearly fills the plot. */
function fitAxis(rows: ChartRow[], series: Series[]): { domain: [number, number]; ticks: number[] } {
  let top = 0
  let bottom = 0
  for (const row of rows) {
    const values = series.map((s) => row[s.key] ?? 0)
    top = Math.max(top, values.reduce((sum, v) => sum + Math.max(0, v), 0))
    bottom = Math.min(bottom, values.reduce((sum, v) => sum + Math.min(0, v), 0))
  }
  const step = roundStep(((top - bottom) * Y_HEADROOM) / TICK_INTERVALS)
  const lo = Math.floor((bottom * Y_HEADROOM) / step) * step
  const hi = Math.ceil((top * Y_HEADROOM) / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t))
  return { domain: [lo, hi], ticks }
}

/** What to say under a milestone's name: what's tied to it, or where it comes from. */
function milestoneSubtext(mark: ChartMilestone, doc: PlanDocument): string {
  if (mark.kind === "depleted") return "Your accounts can't cover spending from this year on."
  if (mark.kind === "child") return "From Kids · edit on Expenses → Kids"
  if (mark.kind === "asset") return "From Assets & debts · edit it there"
  const uses = milestoneUses(doc, mark.id)
  return uses.length > 0 ? `Used by: ${uses.join(" · ")}` : "Nothing is tied to it yet"
}

/** Hover card for a milestone icon, placed just below the icon. */
function MilestoneCard({ hovered, doc }: { hovered: HoveredMark; doc: PlanDocument }) {
  const { mark, x, y } = hovered
  return (
    <div
      className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left: x, top: y + 16 }}
    >
      <p className="font-semibold text-foreground">{mark.name}</p>
      <p className="text-foreground-muted">
        {mark.year} · age {mark.age}
      </p>
      <p className="mt-1 text-[11px] text-foreground-muted">{milestoneSubtext(mark, doc)}</p>
    </div>
  )
}

interface Props {
  doc: PlanDocument
  projection: PlanProjection
  rows: YearRow[]
  basis: DollarBasis
  isHidden: boolean
}

/**
 * One stacked bar per plan year: net worth by tax treatment (with real-asset equity and debt), or
 * cash flow in and out. Hover a bar for that year's P&L panel; click to pin it.
 */
export function PlanNetWorthChart({ doc, projection, rows, basis, isHidden }: Props) {
  const { primary, error, foregroundMuted, border, foreground, success } = useChartTheme()
  const [mode, setMode] = useState<ChartMode>("networth")
  const nwPoints = useMemo(() => netWorthPoints(doc, rows), [doc, rows])
  const cfPoints = useMemo(() => cashFlowPoints(doc, rows), [doc, rows])
  const marks = useMemo(() => chartMilestones(doc, projection), [doc, projection])
  const stacked = useMemo(() => stackMarks(marks), [marks])
  const [hoveredMark, setHoveredMark] = useState<HoveredMark | null>(null)
  // Kids' stages stand out in green; "money runs out" is red; everything else is the accent.
  const markColor = (m: ChartMilestone) => (m.kind === "depleted" ? error : m.kind === "child" ? success : primary)
  const iconRoom = ICON_ROW + Math.max(0, ...stacked.map((s) => s.level)) * ICON_STACK
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const { netWorth: nwColors, cashFlow: cfColors } = usePlanColors()
  const points: ChartRow[] = mode === "networth" ? nwPoints : cfPoints
  const allSeries: Series[] =
    mode === "networth"
      ? [...NET_WORTH_LAYERS, "debt" as const].map((k) => ({ key: k, label: NET_WORTH_LAYER_LABELS[k], color: nwColors[k] }))
      : [...CASH_IN_LAYERS, ...CASH_OUT_LAYERS].map((k) => ({ key: k, label: CASH_FLOW_LABELS[k], color: cfColors[k] }))
  const series = allSeries.filter((s) => points.some((p) => Math.abs(p[s.key] ?? 0) > 0.5))
  const yAxis = fitAxis(points, series)
  const active = selected ?? hovered ?? 0
  const activePoint = nwPoints[active] ?? null
  const metrics = useMemo(
    () => yearMetrics(doc, rows, active, projection.startNetWorth),
    [doc, rows, active, projection.startNetWorth],
  )
  const indexOf = (state: { activeTooltipIndex?: unknown } | null | undefined) => {
    const index = Number(state?.activeTooltipIndex)
    return Number.isInteger(index) && index >= 0 ? index : null
  }

  const bars = ({ key, color }: Series) => (
    <Bar key={key} dataKey={key} stackId="stack" fill={color} isAnimationActive={false} cursor="pointer">
      {points.map((_, i) => (
        <Cell key={i} fillOpacity={selected === null || selected === i ? 0.85 : DIMMED} />
      ))}
    </Bar>
  )

  return (
    <FireSectionCard
      eyebrow={mode === "networth" ? "Net worth" : "Cash flow"}
      title={basis === "today" ? "In today's dollars" : "In future dollars"}
      info={
        mode === "networth"
          ? "Year-end balances by tax treatment. Real-asset equity is what your home and other assets are worth minus the loans on them; other debt shows below zero. Hover a bar to see that year; click to pin it."
          : "Money in above zero (income, withdrawals by account type, asset sales) and where it went below zero (spending, taxes, debt, purchases, savings). The two sides balance every year. Employer match is left out."
      }
      right={<ModeToggle value={mode} onChange={setMode} />}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          <div className="relative h-[340px] lg:h-[500px]" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
            {hoveredMark && <MilestoneCard hovered={hoveredMark} doc={doc} />}
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: iconRoom, right: 12, left: 4, bottom: 0 }}
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
                  domain={yAxis.domain}
                  ticks={yAxis.ticks}
                  allowDataOverflow
                  tick={{ fontSize: 10, fill: foregroundMuted }}
                  tickFormatter={fmtCompact}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={() => null} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
                <ReferenceLine y={0} stroke={border} />
                {series.map(bars)}
                {mode === "networth" && (
                  <Line
                    type="monotone"
                    dataKey="netWorth"
                    stroke={foreground}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {stacked.map(({ mark: m, level }) => (
                  <ReferenceLine
                    key={`${m.name}-${m.age}`}
                    x={m.age}
                    stroke={m.kind === "depleted" ? error : foregroundMuted}
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={<MilestoneMarker mark={m} level={level} color={markColor(m)} onHover={setHoveredMark} />}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            {marks.map((m) => (
              <span
                key={`legend-${m.name}-${m.age}`}
                className="inline-flex items-center gap-1 text-[11px] text-foreground-muted"
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: 13, color: markColor(m) }}
                >
                  {m.icon ?? MILESTONE_ICONS[m.kind]}
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
              colors={{ cash: nwColors.cash, taxable: nwColors.taxable, taxDeferred: nwColors.taxDeferred, taxFree: nwColors.taxFree }}
            />
          </div>
        )}
      </div>
    </FireSectionCard>
  )
}
