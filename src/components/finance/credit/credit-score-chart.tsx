"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { CreditScoreItem } from "@/hooks/finance/use-credit-scores"
import { MAX_SCORE, MIN_SCORE, modelLabel, SCORE_MODELS, SCORE_TIERS } from "@/lib/finance/credit-scores"
import { mix } from "@/components/plans/results/use-plan-colors"

type Point = { t: number } & Record<string, number>

/** Room above and below the scores shown. */
const PAD = 25
/** Bands thinner than this many points get no label room, so they aren't drawn. */
const MIN_BAND = 15

const fmtMonth = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })

/** Each score model as its own line over time, on faint bands for FICO's ranges. */
export function CreditScoreChart({ scores }: { scores: CreditScoreItem[] }) {
  const theme = useChartTheme()
  const { foregroundMuted, border, foreground } = theme
  // Color follows the model, never how many models are shown: FICO family in the accent, VantageScore in amber.
  const modelColors: Record<string, string> = useMemo(
    () => ({
      fico8: theme.primary,
      vantage3: theme.warning,
      vantage4: theme.accentHead,
      "fico-mortgage": mix(theme.primary, theme.card, 0.45),
      "fico-auto": mix(theme.primary, theme.foreground, 0.35),
      other: theme.foregroundMuted,
    }),
    [theme],
  )
  const models = useMemo(() => SCORE_MODELS.map((m) => m.value).filter((m) => scores.some((s) => s.model === m)), [scores])
  const points = useMemo(
    () => [...scores].reverse().map((s) => ({ t: new Date(s.date).getTime(), [s.model]: s.score }) as Point),
    [scores],
  )
  const values = scores.map((s) => s.score)
  const lo = Math.max(MIN_SCORE, Math.floor((Math.min(...values) - PAD) / 10) * 10)
  const hi = Math.min(MAX_SCORE, Math.ceil((Math.max(...values) + PAD) / 10) * 10)
  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          {SCORE_TIERS.filter((t) => Math.min(hi, t.max + 1) - Math.max(lo, t.min) >= MIN_BAND).map((t, i) => (
            <ReferenceArea
              key={t.key}
              y1={Math.max(lo, t.min)}
              y2={Math.min(hi, t.max + 1)}
              fill={foreground}
              fillOpacity={i % 2 === 0 ? 0.04 : 0}
              stroke="none"
              label={{ value: t.label, position: "insideTopRight", fontSize: 10, fill: foregroundMuted }}
            />
          ))}
          <CartesianGrid vertical={false} stroke={border} strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmtMonth} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} />
          <YAxis domain={[lo, hi]} tick={{ fontSize: 10, fill: foregroundMuted }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
          <Tooltip
            formatter={(value, key) => [String(value), modelLabel(String(key))]}
            labelFormatter={(t) => new Date(Number(t)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {models.map((m) => (
            <Line key={m} dataKey={m} type="monotone" stroke={modelColors[m]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: theme.card }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {models.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted">
          {models.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: modelColors[m] }} />
              {modelLabel(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
