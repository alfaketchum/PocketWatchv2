"use client"

import { useMemo, useState } from "react"
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import {
  chartMilestones,
  NET_WORTH_LAYER_LABELS,
  NET_WORTH_LAYERS,
  netWorthPoints,
  type ChartMilestone,
  type NetWorthLayer,
  type NetWorthPoint,
} from "@/lib/plans/plan-chart"
import type { DollarBasis, PlanDocument, PlanProjection, YearRow } from "@/lib/plans/plan-types"
import { PlanYearDetail } from "./plan-year-detail"

const DIMMED = 0.35
const MILESTONE_ICONS: Record<ChartMilestone["kind"], string> = {
  retirement: "beach_access",
  custom: "flag",
  depleted: "warning",
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: NetWorthPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="text-foreground-muted">
        Age {p.age} · {p.year}
      </p>
      <p className="font-semibold text-foreground tabular-nums">{fmtMoney(p.netWorth)} net worth</p>
      {NET_WORTH_LAYERS.filter((k) => p[k] > 0.5).map((k) => (
        <p key={k} className="text-foreground-muted tabular-nums">
          {NET_WORTH_LAYER_LABELS[k]}: {fmtMoney(p[k])}
        </p>
      ))}
      {p.debt < -0.5 && <p className="text-foreground-muted tabular-nums">Debt: {fmtMoney(p.debt)}</p>}
      <p className="text-[10px] text-foreground-muted pt-0.5">Click for the year&apos;s detail</p>
    </div>
  )
}

/** Small round icon at the top of a milestone's line; hover shows its name. */
function MilestoneMarker({ viewBox, mark, color }: { viewBox?: { x: number; y: number }; mark: ChartMilestone; color: string }) {
  if (!viewBox) return null
  const cx = viewBox.x
  const cy = viewBox.y + 10
  return (
    <g style={{ cursor: "default" }}>
      <title>{`${mark.name} · age ${mark.age} (${mark.year})`}</title>
      <circle cx={cx} cy={cy} r={10} fill={color} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={13} fontFamily="Material Symbols Rounded">
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
  const selectedRow = selected !== null ? (rows[selected] ?? null) : null
  const selectedPoint = selected !== null ? (points[selected] ?? null) : null

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
      info="Year-end balances by tax treatment. Real-asset equity is what your home and other assets are worth minus the loans on them; other debt shows below zero. Click a bar to see that year."
    >
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
            stackOffset="sign"
            barCategoryGap="12%"
            onClick={(state) => {
              const index = Number(state?.activeTooltipIndex)
              if (Number.isInteger(index) && index >= 0) setSelected(index === selected ? null : index)
            }}
          >
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: foreground, fillOpacity: 0.05 }} />
            <ReferenceLine y={0} stroke={border} />
            {shownLayers.map(bars)}
            {hasDebt && bars("debt")}
            <Line type="monotone" dataKey="netWorth" stroke={foreground} strokeWidth={1.5} dot={false} isAnimationActive={false} />
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
          <span key={`legend-${m.name}-${m.age}`} className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
            <span className="material-symbols-rounded" style={{ fontSize: 13, color: m.kind === "depleted" ? error : primary }}>
              {MILESTONE_ICONS[m.kind]}
            </span>
            {m.name} ({m.age})
          </span>
        ))}
      </div>
      {selectedPoint && (
        <div className="mt-4 rounded-xl border border-card-border p-4 space-y-3" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Age {selectedPoint.age} · {selectedPoint.year}
              <span className="ml-2 font-normal text-foreground-muted tabular-nums">{fmtMoney(selectedPoint.netWorth)} net worth at year end</span>
            </p>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close year detail" className="btn-ghost h-7 px-1.5 text-foreground-muted">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                close
              </span>
            </button>
          </div>
          {selectedRow && <PlanYearDetail row={selectedRow} doc={doc} />}
        </div>
      )}
    </FireSectionCard>
  )
}
