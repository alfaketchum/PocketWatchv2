"use client"

import type { ChartMilestone } from "@/lib/plans/plan-chart"
import type { TooltipSeries } from "./plan-bar-tooltip"
import { MILESTONE_ICONS } from "./plan-chart-plot"

const HEADING = "text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted"

function Swatch({ label, color, bold }: { label: string; color: string; bold?: boolean }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] ${bold ? "font-medium text-foreground" : "text-foreground-muted"}`}>
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

/** Bands bunched by their parent band, in chart order. */
function byGroup(series: TooltipSeries[]) {
  const groups = new Map<string, { head: NonNullable<TooltipSeries["group"]>; items: TooltipSeries[] }>()
  for (const s of series) {
    const head = s.group ?? { key: s.key, label: s.label, color: s.color }
    groups.set(head.key, { head, items: [...(groups.get(head.key)?.items ?? []), s] })
  }
  return [...groups.values()]
}

/** With subcategories: one column per band, its accounts, assets or lines listed beneath it. */
function GroupedBands({ series }: { series: TooltipSeries[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-3">
      {byGroup(series).map(({ head, items }) => {
        const lines = items.filter((s) => s.label !== head.label)
        return (
          <div key={head.key} className="min-w-0 space-y-1">
            <Swatch label={head.label} color={head.color} bold />
            {lines.length > 0 && (
              <ul className="space-y-0.5 border-l border-card-border pl-2.5">
                {lines.map((s) => (
                  <li key={s.key} className="flex min-w-0">
                    <Swatch label={s.label} color={s.color} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface Props {
  series: TooltipSeries[]
  /** Dashed lines drawn over the bars (e.g. "Still owed"). */
  lines: string[]
  marks: ChartMilestone[]
  markColor: (m: ChartMilestone) => string
}

/** The chart's key: bands (grouped under their parent with subcategories), dashed lines, then milestones on their own row. */
export function PlanChartLegend({ series, lines, marks, markColor }: Props) {
  const grouped = series.some((s) => s.group)
  return (
    <div className="mt-3 space-y-3">
      {grouped ? (
        <>
          <GroupedBands series={series} />
          {lines.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {lines.map((l) => <DashedKey key={l} label={l} />)}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => <Swatch key={s.key} label={s.label} color={s.color} />)}
          {lines.map((l) => <DashedKey key={l} label={l} />)}
        </div>
      )}
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
