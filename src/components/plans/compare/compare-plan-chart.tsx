"use client"

import { memo, useCallback, useState } from "react"
import { milestoneGroup, type ChartMilestone } from "@/lib/plans/plan-chart"
import type { PlanDocument } from "@/lib/plans/plan-types"
import { ChartPlot, type HoveredMark } from "../results/plan-chart-plot"
import { MilestoneCard } from "../results/plan-milestone-card"
import type { ChartMode, ChartRow, Series } from "../results/use-chart-series"
import { usePlanColors } from "../results/use-plan-colors"

interface Props {
  side: "A" | "B"
  name: string
  color: string
  doc: PlanDocument
  points: ChartRow[]
  series: Series[]
  yAxis: { domain: [number, number]; ticks: number[] }
  iconRoom: number
  stacked: { mark: ChartMilestone; level: number }[]
  mode: ChartMode
  hasDebt: boolean
  selected: number | null
  onHover: (index: number | null) => void
  onSelect: (index: number) => void
  onClear: () => void
  isHidden: boolean
}

/** One plan's stacked bars, named and colored as A or B; the highlighted year follows the other chart. */
export const ComparePlanChart = memo(function ComparePlanChart({ side, name, color, doc, isHidden, ...plot }: Props) {
  const { milestones: groupColors } = usePlanColors()
  const markColor = useCallback((m: ChartMilestone) => groupColors[milestoneGroup(m)], [groupColors])
  const [hoveredMark, setHoveredMark] = useState<HoveredMark | null>(null)
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white" style={{ background: color }}>
          {side}
        </span>
        <span className="truncate">{name}</span>
      </p>
      <div className="relative h-[300px] lg:h-[380px]" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        {hoveredMark && <MilestoneCard hovered={hoveredMark} doc={doc} />}
        <ChartPlot {...plot} showSteady={false} markColor={markColor} onHoverMark={setHoveredMark} focused={false} />
      </div>
    </div>
  )
})
