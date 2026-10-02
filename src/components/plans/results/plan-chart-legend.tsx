"use client"

import type { ChartMilestone } from "@/lib/plans/plan-chart"
import type { TooltipSeries } from "./plan-bar-tooltip"
import { MILESTONE_ICONS } from "./plan-chart-plot"

const HEADING = "text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-foreground-muted">
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="truncate" title={label}>
        {label}
      </span>
    </span>
  )
}

function DashedKey({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
      <span className="w-3 border-t-[1.5px] border-dashed border-foreground/60" />
      {label}
    </span>
  )
}

/** The bands in chart order: each series' parent, or the series itself when it has none. */
function bandsOf(series: TooltipSeries[]): NonNullable<TooltipSeries["group"]>[] {
  const bands = new Map<string, NonNullable<TooltipSeries["group"]>>()
  for (const s of series) {
    const band = s.group ?? { key: s.key, label: s.label, color: s.color }
    if (!bands.has(band.key)) bands.set(band.key, band)
  }
  return [...bands.values()]
}

interface Props {
  series: TooltipSeries[]
  /** Dashed lines drawn over the bars (e.g. "Still owed"). */
  lines: string[]
  marks: ChartMilestone[]
  markColor: (m: ChartMilestone) => string
}

/** The chart's key: its bands (parents only, with subcategories on), dashed lines, then milestones on their own row. */
export function PlanChartLegend({ series, lines, marks, markColor }: Props) {
  // With subcategories the bars are shades of their band: the legend names the bands; the hover card names each part.
  const bands = bandsOf(series)
  return (
    <div className="mt-3 space-y-3 lg:max-h-[45%] lg:shrink-0 lg:overflow-y-auto">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {bands.map((b) => <Swatch key={b.key} label={b.label} color={b.color} />)}
        {lines.map((l) => <DashedKey key={l} label={l} />)}
      </div>
      {marks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-card-border pt-2.5">
          <span className={HEADING}>Milestones</span>
          {marks.map((m) => (
            <span key={`legend-${m.name}-${m.age}`} className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
              <span className="material-symbols-rounded" style={{ fontSize: 13, color: markColor(m) }} aria-hidden="true">
                {m.icon ?? MILESTONE_ICONS[m.kind]}
              </span>
              {m.name} <span className="tabular-nums">({m.age})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
