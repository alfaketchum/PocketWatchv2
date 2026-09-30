"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { PlanListItem } from "@/hooks/plans/shared"

type Row = { year: number } & Record<string, number>

/** Net worth by year (today's dollars) for each summary's sparkline, keyed by plan id. */
function rowsFor(plans: PlanListItem[]): Row[] {
  const byYear = new Map<number, Row>()
  for (const plan of plans) {
    const s = plan.summary
    if (!s) continue
    const firstYear = s.endYear - s.spark.length + 1
    s.spark.forEach((value, i) => {
      const year = firstYear + i
      byYear.set(year, { ...(byYear.get(year) ?? { year }), [plan.id]: value } as Row)
    })
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year)
}

/** Net worth of each selected plan, overlaid. */
export function CompareChart({ plans, colors, isHidden }: { plans: PlanListItem[]; colors: string[]; isHidden: boolean }) {
  const { foregroundMuted, border } = useChartTheme()
  const rows = useMemo(() => rowsFor(plans), [plans])
  const names = Object.fromEntries(plans.map((p) => [p.id, p.name]))
  return (
    <FireSectionCard eyebrow="Net worth" title="Year-end net worth, today's dollars">
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              formatter={(value, key) => [fmtCompact(Number(value)), names[String(key)] ?? String(key)]}
              labelFormatter={(year) => String(year)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            {plans.map((p, i) => (
              <Line key={p.id} type="monotone" dataKey={p.id} stroke={colors[i]} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {plans.map((p, i) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors[i] }} />
            {p.name}
          </span>
        ))}
      </div>
    </FireSectionCard>
  )
}
