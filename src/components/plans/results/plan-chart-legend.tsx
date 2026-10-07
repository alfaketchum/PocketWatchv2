"use client"

import { HybridTooltip } from "@/components/ui/hybrid-tooltip"
import type { ChartMilestone } from "@/lib/plans/plan-chart"
import { BAND_DEFINITIONS, MARK_DEFINITIONS } from "@/lib/plans/plan-term-definitions"
import type { TooltipSeries } from "./plan-bar-tooltip"
import { MILESTONE_ICONS } from "./plan-chart-plot"

/** A legend label; terms with a definition get a dotted underline and explain themselves on hover (tap on touch). */
function Term({ label, definition }: { label: string; definition?: string }) {
  if (!definition) return <>{label}</>
  return (
    <HybridTooltip content={definition} contentClassName="text-xs">
      <button type="button" className="cursor-help underline decoration-dotted underline-offset-2">
        {label}
      </button>
    </HybridTooltip>
  )
}

function Swatch({ label, color, definition }: { label: string; color: string; definition?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-foreground-muted">
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="truncate" title={definition ? undefined : label}>
        <Term label={label} definition={definition} />
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

/** The chart's key on one row, left to right: milestones, a divider, then the bands and dashed lines. */
export function PlanChartLegend({ series, lines, marks, markColor }: Props) {
  // With subcategories the bars are shades of their band: the legend names the bands; the hover card names each part.
  const bands = bandsOf(series)
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {marks.map((m) => (
        <span key={`legend-${m.name}-${m.age}`} className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
          <span className="material-symbols-rounded" style={{ fontSize: 13, color: markColor(m) }} aria-hidden="true">
            {m.icon ?? MILESTONE_ICONS[m.kind]}
          </span>
          <Term label={m.name} definition={MARK_DEFINITIONS[m.kind]} /> <span className="tabular-nums">({m.age})</span>
        </span>
      ))}
      {marks.length > 0 && <span className="h-3.5 w-px shrink-0 bg-card-border-hover" aria-hidden="true" />}
      {bands.map((b) => <Swatch key={b.key} label={b.label} color={b.color} definition={BAND_DEFINITIONS[b.key]} />)}
      {lines.map((l) => <DashedKey key={l} label={l} />)}
    </div>
  )
}
