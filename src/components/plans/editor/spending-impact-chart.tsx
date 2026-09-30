"use client"

import { useMemo } from "react"
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { spendingImpact, type ImpactPoint } from "@/lib/plans/plan-spending-impact"
import type { PlanDocument } from "@/lib/plans/plan-types"

const HEIGHT = 170
const LATE_AGE = 80

function Stat({ label, value, steady }: { label: string; value: number; steady: number }) {
  const diff = steady > 0 ? value / steady - 1 : 0
  const tone = Math.abs(diff) < 0.005 ? "text-foreground-muted" : diff < 0 ? "text-success" : "text-error"
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(value)}</p>
      <p className={`text-[11px] tabular-nums ${tone}`}>
        {Math.abs(diff) < 0.005 ? "same as all steady" : `${diff > 0 ? "+" : "−"}${Math.abs(diff * 100).toFixed(0)}% vs all steady`}
      </p>
    </div>
  )
}

function ImpactTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ImpactPoint }> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">
        Age {p.age} · {p.year}
      </p>
      <p className="text-foreground">With your patterns: {fmtMoney(p.withPatterns)}</p>
      <p className="text-foreground-muted">All steady: {fmtMoney(p.steady)}</p>
    </div>
  )
}

/**
 * Spending by age in today's dollars with each line's pattern, against every line steady (dashed), so the
 * effect of changing patterns shows as you make it. Runs the whole plan: kids, home and car costs, moves.
 */
export function SpendingImpactChart({ doc }: { doc: PlanDocument }) {
  const { primary, foregroundMuted, border } = useChartTheme()
  const impact = useMemo(() => spendingImpact(doc), [doc])
  const at = (age: number | null) => (age === null ? undefined : impact.points.find((p) => p.age === age))
  const retire = at(impact.retireAge)
  const late = at(LATE_AGE)

  return (
    <div className="rounded-xl border border-card-border p-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Recurring spending over your life <span className="font-normal text-foreground-muted">(today&apos;s dollars, one-time costs left out)</span>
        </p>
        <p className="text-[11px] text-foreground-muted">Solid: with your patterns · dashed: all steady</p>
      </div>
      <div style={{ height: HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={impact.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="age" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<ImpactTooltip />} />
            {impact.retireAge !== null && <ReferenceLine x={impact.retireAge} stroke={foregroundMuted} strokeDasharray="2 3" label={{ value: "Retire", fontSize: 10, fill: foregroundMuted, position: "insideTopRight" }} />}
            <Area type="stepAfter" dataKey="withPatterns" stroke={primary} fill={primary} fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="steady" stroke={foregroundMuted} strokeDasharray="4 3" dot={false} strokeWidth={1.25} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Lifetime" value={impact.lifetime.withPatterns} steady={impact.lifetime.steady} />
        {retire ? <Stat label={`At retirement (${retire.age})`} value={retire.withPatterns} steady={retire.steady} /> : <div />}
        {late ? <Stat label={`At ${LATE_AGE}`} value={late.withPatterns} steady={late.steady} /> : <div />}
      </div>
    </div>
  )
}
