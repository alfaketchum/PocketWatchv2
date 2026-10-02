"use client"

import type { TooltipSeries } from "./plan-bar-tooltip"

function Swatch({ label, color, bold }: { label: string; color: string; bold?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${bold ? "font-medium text-foreground" : "text-foreground-muted"}`}>
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}

/** Bands bunched by their parent band. */
function byGroup(series: TooltipSeries[]) {
  const groups = new Map<string, { head: NonNullable<TooltipSeries["group"]>; items: TooltipSeries[] }>()
  for (const s of series) {
    const head = s.group ?? { key: s.key, label: s.label, color: s.color }
    groups.set(head.key, { head, items: [...(groups.get(head.key)?.items ?? []), s] })
  }
  return [...groups.values()]
}

/** The chart's bands; with subcategories, each band's name followed by the accounts, assets or lines in it. */
export function PlanChartLegend({ series }: { series: TooltipSeries[] }) {
  if (!series.some((s) => s.group)) return <>{series.map((s) => <Swatch key={s.key} label={s.label} color={s.color} />)}</>
  return (
    <div className="w-full space-y-1">
      {byGroup(series).map(({ head, items }) => (
        <div key={head.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <Swatch label={head.label} color={head.color} bold />
          {items
            .filter((s) => s.group && s.label !== head.label)
            .map((s) => (
              <Swatch key={s.key} label={s.label} color={s.color} />
            ))}
        </div>
      ))}
    </div>
  )
}
