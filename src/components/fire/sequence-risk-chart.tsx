"use client"

import { useMemo } from "react"
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts"
import { useChartTheme } from "@/hooks/use-chart-theme"
import type { CohortSummary } from "@/lib/fire/fire-types"
import { fmtMonth, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

interface Point {
  ym: string
  first10: number
  maxWr: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: Point }>
}

function SeqTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">Retire {fmtMonth(p.ym)}</p>
      <p className="text-foreground-muted">First 10 yrs: <b className="text-foreground">{fmtPct(p.first10, 1)}/yr real</b></p>
      <p className="text-foreground-muted">Max safe WR: <b className="text-foreground">{fmtPct(p.maxWr, 2)}</b></p>
    </div>
  )
}

function correlation(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

/** Sequence-of-returns risk: returns in the first decade explain most of a cohort's safe WR. */
export function SequenceRiskChart({ summaries, wr }: { summaries: CohortSummary[]; wr: number }) {
  const { primary, error, foregroundMuted, border } = useChartTheme()

  const { safe, failed, corr } = useMemo(() => {
    const points: Point[] = summaries
      .filter((s) => s.first10YrReturn !== null && s.month.endsWith("-01"))
      .map((s) => ({ ym: s.month, first10: s.first10YrReturn as number, maxWr: s.maxWr }))
    return {
      safe: points.filter((p) => p.maxWr >= wr),
      failed: points.filter((p) => p.maxWr < wr),
      corr: correlation(points.map((p) => p.first10), points.map((p) => p.maxWr)),
    }
  }, [summaries, wr])

  return (
    <FireSectionCard
      eyebrow="Sequence-of-returns risk"
      title="The first 10 years decide most of the outcome"
      info="Each dot is a January retirement cohort: its portfolio's real return over the first decade vs the max rate it could sustain. Bad early returns force selling low, and the portfolio rarely recovers — even if later decades are great."
      right={corr !== null ? <span className="text-xs text-foreground-muted">Correlation <b className="text-foreground">{corr.toFixed(2)}</b></span> : undefined}
    >
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
          <CartesianGrid stroke={border} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="first10" name="First 10 years" tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => fmtPct(v, 0)} axisLine={false} tickLine={false} label={{ value: "Real return, first 10 years", position: "insideBottom", offset: -4, fontSize: 10, fill: foregroundMuted }} />
          <YAxis type="number" dataKey="maxWr" name="Max safe WR" tick={{ fontSize: 10, fill: foregroundMuted }} tickFormatter={(v: number) => fmtPct(v, 0)} axisLine={false} tickLine={false} width={40} />
          <ZAxis range={[18, 18]} />
          <Tooltip content={<SeqTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter name="Sustained your rate" data={safe} fill={primary} fillOpacity={0.55} animationDuration={600} />
          <Scatter name="Failed at your rate" data={failed} fill={error} fillOpacity={0.8} animationDuration={600} />
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Sustained {fmtPct(wr, 2)}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error inline-block" /> Would have failed</span>
      </div>
    </FireSectionCard>
  )
}
