"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { ScoreYear } from "@/lib/plans/credit-projection"

const PAD = 15
const STEP = 20

function EventTip({ active, payload }: { active?: boolean; payload?: { payload: ScoreYear }[] }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-card-border bg-card px-2.5 py-1.5 text-[11px] shadow-sm">
      <div className="font-medium text-foreground">
        {p.year}: {p.score}
      </div>
      {p.events.map((e) => (
        <div key={e} className="text-foreground-muted">
          {e}
        </div>
      ))}
    </div>
  )
}

/** The projected score year by year; dots mark years with something happening. */
export function CreditPathChart({ path }: { path: ScoreYear[] }) {
  const { primary, foregroundMuted, card } = useChartTheme()
  const scores = path.map((p) => p.score)
  const lo = Math.max(300, Math.floor((Math.min(...scores) - PAD) / STEP) * STEP)
  const hi = Math.min(850, Math.ceil((Math.max(...scores) + PAD) / STEP) * STEP)
  const ticks = [lo, Math.round((lo + hi) / 2 / STEP) * STEP, hi]
  return (
    <div>
      <p className="text-[11px] text-foreground-muted mb-1">Projected score, assuming every payment is on time</p>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={path} margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis domain={[lo, hi]} ticks={ticks} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
          <Tooltip content={<EventTip />} />
          <Line
            type="stepAfter"
            dataKey="score"
            stroke={primary}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index !== undefined && path[props.index]?.events.length ? (
                <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={primary} stroke={card} strokeWidth={2} />
              ) : (
                <g key={props.index} />
              )
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
