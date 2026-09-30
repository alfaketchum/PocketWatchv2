"use client"

import { useMemo } from "react"
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { FireSectionCard } from "@/components/fire/fire-section-card"
import type { ProgressPoint } from "@/lib/plans/plan-progress"

/** Years of the plan shown past today, so the near future is visible. */
const YEARS_AHEAD = 5

interface Point {
  x: number
  actual?: number
  plan?: number
}

function merge(actual: ProgressPoint[], plan: ProgressPoint[], until: number): Point[] {
  const points: Point[] = [
    ...actual.map((p) => ({ x: p.x, actual: p.value })),
    ...plan.filter((p) => p.x <= until).map((p) => ({ x: p.x, plan: p.value })),
  ]
  return points.sort((a, b) => a.x - b.x)
}

function monthLabel(x: number): string {
  const year = Math.floor(x)
  const month = Math.min(11, Math.round((x - year) * 12))
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function ProgressTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const value = p.actual ?? p.plan
  if (value === undefined) return null
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-foreground-muted">
        {monthLabel(p.x)} · {p.actual !== undefined ? "actual" : "plan"}
      </p>
      <p className="font-semibold text-foreground tabular-nums">{fmtMoney(value)}</p>
    </div>
  )
}

/** Actual net worth (solid) against the plan's path (dashed), nominal dollars. */
export function ProgressChart({
  actual,
  plan,
  now,
  isHidden,
}: {
  actual: ProgressPoint[]
  plan: ProgressPoint[]
  now: number
  isHidden: boolean
}) {
  const { primary, foregroundMuted, border } = useChartTheme()
  const data = useMemo(() => merge(actual, plan, now + YEARS_AHEAD), [actual, plan, now])
  return (
    <FireSectionCard
      eyebrow="Plan vs actual"
      title="Net worth, accounts minus debts"
      info="Actual comes from your linked accounts and wallets. Homes and other manual assets are left out of both lines, since your history doesn't track them. Both lines are in dollars of the day (not inflation-adjusted)."
    >
      <div style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => String(Math.floor(v))} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<ProgressTooltip />} />
            <ReferenceLine x={now} stroke={foregroundMuted} strokeDasharray="4 4" label={{ value: "Today", position: "insideTopRight", fontSize: 10, fill: foregroundMuted }} />
            <Line type="monotone" dataKey="actual" stroke={primary} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line type="linear" dataKey="plan" stroke={foregroundMuted} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </FireSectionCard>
  )
}
