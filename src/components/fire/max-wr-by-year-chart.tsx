"use client"

import { useMemo } from "react"
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { CohortSummary } from "@/lib/fire/fire-types"
import { fmtMonth, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

interface Point {
  ym: string
  x: number
  maxWr: number
  cape: number | null
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: Point }>
}

function WrTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">Retire {fmtMonth(p.ym)}</p>
      <p className="text-foreground-muted">Max safe WR: <b className="text-foreground">{fmtPct(p.maxWr, 2)}</b></p>
      {p.cape !== null && <p className="text-foreground-muted">CAPE at start: <b className="text-foreground">{p.cape.toFixed(1)}</b></p>}
    </div>
  )
}

/** Max sustainable WR per start month next to the CAPE at retirement — ERN's valuation insight. */
export function MaxWrByYearChart({ summaries, wr, horizonYears }: { summaries: CohortSummary[]; wr: number; horizonYears: number }) {
  const { primary, warning, foregroundMuted, border, error } = useChartTheme()

  const data = useMemo<Point[]>(
    () =>
      summaries
        .filter((s) => s.month.endsWith("-01") || s.month.endsWith("-07"))
        .map((s) => ({ ym: s.month, x: Number(s.month.slice(0, 4)) + (Number(s.month.slice(5, 7)) - 1) / 12, maxWr: s.maxWr, cape: s.cape })),
    [summaries],
  )

  return (
    <FireSectionCard
      eyebrow="When you retire matters"
      title={`Max safe ${horizonYears}-year withdrawal rate by start date, vs Shiller CAPE`}
      info="The highest rate each cohort could sustain. Dips line up with CAPE peaks (1929, 1966, 2000): high valuations at retirement mean lower safe rates. The dashed line is your rate — cohorts below it would have failed."
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => String(Math.floor(v))} axisLine={false} tickLine={false} />
          <YAxis yAxisId="wr" tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => fmtPct(v, 0)} axisLine={false} tickLine={false} width={40} domain={[0, "auto"]} />
          <YAxis yAxisId="cape" orientation="right" tick={{ fontSize: 10, fill: warning }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<WrTooltip />} />
          <ReferenceLine yAxisId="wr" y={wr} stroke={error} strokeDasharray="4 4" label={{ value: `Your ${fmtPct(wr, 2)}`, position: "insideTopLeft", fontSize: 10, fill: error }} />
          <Line yAxisId="wr" type="monotone" dataKey="maxWr" name="Max safe WR" stroke={primary} strokeWidth={1.75} dot={false} animationDuration={600} />
          <Line yAxisId="cape" type="monotone" dataKey="cape" name="CAPE" stroke={warning} strokeWidth={1.25} strokeOpacity={0.8} dot={false} connectNulls animationDuration={600} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-primary inline-block" /> Max safe WR (left)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-warning inline-block" /> CAPE at retirement (right)</span>
      </div>
    </FireSectionCard>
  )
}
