"use client"

import { useCallback, useMemo, useState } from "react"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { chartMilestones } from "@/lib/plans/plan-chart"
import { BASIC_CHART_VIEWS } from "@/lib/plans/plan-mode"
import type { DollarBasis, PlanDocument, PlanProjection, YearRow } from "@/lib/plans/plan-types"
import { DollarsToggle } from "../results/dollars-toggle"
import { fitAxis, stackMarks } from "../results/plan-chart-axis"
import { chartModes, DetailToggle, ModeToggle } from "../results/plan-chart-controls"
import { ICON_ROW, ICON_STACK } from "../results/plan-chart-plot"
import { PlanChartLegend } from "../results/plan-chart-legend"
import { useChartDetail } from "../results/use-chart-detail"
import { useChartSeries, type ChartMode } from "../results/use-chart-series"
import { alignYears, diffRows, unionSeries } from "./compare-helpers"
import { CompareDiffChart } from "./compare-diff-chart"
import { ComparePlanChart } from "./compare-plan-chart"
import { CompareYearCard } from "./compare-year-card"

export interface ComparedPlan {
  name: string
  /** Expanded document (generated items folded in), as the plan page charts use. */
  view: PlanDocument
  projection: PlanProjection
  rows: YearRow[]
}

interface Props {
  a: ComparedPlan
  b: ComparedPlan
  colors: [string, string]
  basis: DollarBasis
  onBasisChange: (basis: DollarBasis) => void
  isHidden: boolean
}

/** The legend lists bands only; each chart marks its own milestones. */
const noMarkColor = () => ""

/** Milestone icons for one plan, and the room above the bars they take. */
function useMarks(plan: ComparedPlan) {
  return useMemo(() => {
    const stacked = stackMarks(chartMilestones(plan.view, plan.projection))
    return { stacked, marks: stacked.map((s) => s.mark), room: ICON_ROW + Math.max(0, ...stacked.map((s) => s.level)) * ICON_STACK }
  }, [plan.view, plan.projection])
}

/**
 * A and B side by side in one view, with B − A below. One view switch drives all three; hovering a year shows it in the
 * year card, pinning it highlights it everywhere. "Same scale" puts A and B on one axis so bar heights compare directly.
 */
export function CompareCharts({ a, b, colors, basis, onBasisChange, isHidden }: Props) {
  const { isBasic } = usePlanMode()
  const [pickedMode, setMode] = useState<ChartMode>("networth")
  const [savedDetail, setDetail] = useChartDetail()
  const [sameScale, setSameScale] = useState(true)
  const [breakdown, setBreakdown] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const mode = isBasic && !BASIC_CHART_VIEWS.includes(pickedMode) ? "networth" : pickedMode
  const detail = savedDetail && !isBasic

  const sa = useChartSeries(a.view, a.rows, mode, detail, true)
  const sb = useChartSeries(b.view, b.rows, mode, detail, true)
  const hasDebt = sa.hasDebt || sb.hasDebt
  const view: ChartMode = mode === "debt" && !hasDebt ? "networth" : mode
  const series = useMemo(() => unionSeries(sa.series, sb.series), [sa.series, sb.series])
  const keys = useMemo(() => series.map((s) => s.key), [series])
  const aligned = useMemo(() => alignYears(sa.points, sb.points, keys), [sa.points, sb.points, keys])
  const diff = useMemo(
    () => diffRows(aligned.a, aligned.b, keys, new Set(sa.points.map((p) => p.year)), new Set(sb.points.map((p) => p.year))),
    [aligned, keys, sa.points, sb.points],
  )
  const axes = useMemo(() => {
    if (sameScale) {
      const shared = fitAxis([...aligned.a, ...aligned.b], series)
      return { a: shared, b: shared }
    }
    return { a: fitAxis(aligned.a, series), b: fitAxis(aligned.b, series) }
  }, [sameScale, aligned, series])
  const marksA = useMarks(a)
  const marksB = useMarks(b)
  // Same icon room on both sides, so equal values sit at equal heights.
  const iconRoom = Math.max(marksA.room, marksB.room)

  const togglePinned = useCallback((i: number) => setPinned((cur) => (cur === i ? null : i)), [])
  const unpin = useCallback(() => setPinned(null), [])
  const highlighted = pinned ?? hovered
  // With nothing highlighted, the card shows the last year both plans run.
  const lastShared = diff.reduce((last, r, i) => (r.inBoth ? i : last), diff.length - 1)
  const active = highlighted ?? lastShared
  const cashflow = view === "cashflow"

  const side = (plan: ComparedPlan, which: "A" | "B") => (
    <ComparePlanChart
      side={which}
      name={plan.name}
      color={colors[which === "A" ? 0 : 1]}
      doc={plan.view}
      points={which === "A" ? aligned.a : aligned.b}
      series={series}
      yAxis={which === "A" ? axes.a : axes.b}
      iconRoom={iconRoom}
      stacked={(which === "A" ? marksA : marksB).stacked}
      mode={view}
      hasDebt={hasDebt}
      // Pinned only: a hover changes just the year card, so moving the mouse doesn't redraw every bar of three charts.
      selected={pinned}
      onHover={setHovered}
      onSelect={togglePinned}
      onClear={unpin}
      isHidden={isHidden}
    />
  )

  return (
    <FireSectionCard
      eyebrow="Side by side"
      title={basis === "today" ? "In today's dollars" : "In future dollars"}
      center={<ModeToggle value={view} onChange={setMode} modes={chartModes(hasDebt, isBasic)} />}
      right={
        <div className="flex flex-wrap items-center gap-3">
          {!isBasic && view !== "accounts" && <DetailToggle checked={detail} onChange={setDetail} />}
          <DetailToggle checked={sameScale} onChange={setSameScale} label="Same scale" />
          {!isBasic && <DollarsToggle value={basis} onChange={onBasisChange} />}
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {side(a, "A")}
        {side(b, "B")}
      </div>
      <PlanChartLegend series={series} lines={[]} marks={[]} markColor={noMarkColor} />

      <div className="mt-6 border-t border-card-border pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            Difference <span className="font-normal text-foreground-muted">B − A each year{cashflow ? ", by band" : ""}</span>
          </p>
          {!cashflow && <DetailToggle checked={breakdown} onChange={setBreakdown} label="By band" />}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="h-[220px] lg:h-[260px]" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
            <CompareDiffChart rows={diff} series={series} mode={view} breakdown={breakdown || cashflow} selected={pinned} onHover={setHovered} onSelect={togglePinned} />
          </div>
          {aligned.a[active] && aligned.b[active] && (
            <CompareYearCard
              a={aligned.a[active]}
              b={aligned.b[active]}
              inBoth={!!diff[active]?.inBoth}
              series={series}
              mode={view}
              colors={colors}
              pinned={pinned !== null}
              onUnpin={unpin}
              isHidden={isHidden}
            />
          )}
        </div>
      </div>
    </FireSectionCard>
  )
}
