"use client"

import { trialStatus, TRIAL_TONE_CLASS } from "@/lib/plans/stress/stress-labels"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtCompact, fmtMoney } from "@/components/fire/fire-helpers"
import { useChartTheme } from "@/hooks/use-chart-theme"
import { NARROW_AXIS_WIDTH, useIsNarrow } from "@/hooks/use-is-narrow"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const HEIGHT = 240

function CohortTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CohortResult & { end: number } }> }) {
  const c = payload?.[0]?.payload
  if (!active || !c) return null
  return (
    <div className="space-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">Starting {c.year}</p>
      <p className={TRIAL_TONE_CLASS[trialStatus(c).tone]}>{trialStatus(c).text}</p>
      <p className="text-foreground-muted">Ending net worth: {fmtMoney(c.end)}</p>
      {c.cape !== null && <p className="text-foreground-muted">CAPE then: {c.cape.toFixed(1)}</p>}
    </div>
  )
}

/** Ending net worth (today's dollars) for each historical start year; amber where the portfolio was depleted, red where assets were exhausted. */
export function StressCohortBars({ cohorts, isHidden }: { cohorts: CohortResult[]; isHidden: boolean }) {
  const { primary, error, warning, foregroundMuted, border, foreground } = useChartTheme()
  const axisWidth = useIsNarrow() ? NARROW_AXIS_WIDTH : 56
  const data = cohorts.map((c) => ({ ...c, end: c.netWorth.at(-1) ?? 0 }))
  return (
    <div style={{ height: HEIGHT, filter: isHidden ? "blur(8px)" : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap="12%">
          <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: foregroundMuted }} tickLine={false} axisLine={false} width={axisWidth} />
          <Tooltip content={<CohortTooltip />} cursor={{ fill: foreground, fillOpacity: 0.06 }} />
          <Bar dataKey="end" isAnimationActive={false}>
            {data.map((c) => (
              <Cell key={c.year} fill={{ ok: primary, warn: warning, bad: error }[trialStatus(c).tone]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
