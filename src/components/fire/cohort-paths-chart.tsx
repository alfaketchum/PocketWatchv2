"use client"

import { useMemo, useState } from "react"
import { NOTABLE_COHORTS } from "@/lib/fire/fire-constants"
import { cohortCount, simulateCohort } from "@/lib/fire/swr-simulation"
import type { MarketHistory, SimOptions } from "@/lib/fire/fire-types"
import { fmtCompact, fmtMonth, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

const W = 720
const H = 300
const PAD = { top: 12, right: 12, bottom: 24, left: 48 }
/** Y-axis cap as a multiple of the starting portfolio, so a few boom paths don't flatten the rest. */
const Y_CAP = 3

interface CohortLine {
  ym: string
  points: number[]
  failed: boolean
  notable: boolean
}

function toPolyline(points: number[], years: number): string {
  const xScale = (W - PAD.left - PAD.right) / years
  const yScale = (H - PAD.top - PAD.bottom) / Y_CAP
  return points
    .map((v, i) => `${(PAD.left + i * xScale).toFixed(1)},${(H - PAD.bottom - Math.min(v, Y_CAP) * yScale).toFixed(1)}`)
    .join(" ")
}

interface CohortPathsChartProps {
  history: MarketHistory
  wr: number
  opts: SimOptions
  portfolio: number
  isHidden: boolean
}

/** Every January retirement since 1871 at the user's withdrawal rate; famous bad starts highlighted. */
export function CohortPathsChart({ history, wr, opts, portfolio, isHidden }: CohortPathsChartProps) {
  const [hover, setHover] = useState<string | null>(null)
  const years = opts.horizonMonths / 12

  const { lines, successRate } = useMemo(() => {
    const count = cohortCount(history, opts.horizonMonths)
    const out: CohortLine[] = []
    let ok = 0
    let total = 0
    for (let s = 0; s < count; s++) {
      const ym = history.months[s]
      const notable = (NOTABLE_COHORTS as readonly string[]).includes(ym)
      if (!ym.endsWith("-01") && !notable) continue
      const path = simulateCohort(history, s, wr, opts)
      const points = Array.from({ length: years + 1 }, (_, y) => path[y * 12])
      const failed = points[points.length - 1] <= 0 || points[points.length - 1] < opts.finalValue - 1e-9
      if (!notable || ym.endsWith("-01")) {
        total++
        if (!failed) ok++
      }
      out.push({ ym, points, failed, notable })
    }
    return { lines: out, successRate: total ? ok / total : null }
  }, [history, wr, opts, years])

  const ticks = [0, 1, 2, 3].map((m) => ({ m, y: H - PAD.bottom - (m / Y_CAP) * (H - PAD.top - PAD.bottom) }))
  const hovered = lines.find((l) => l.ym === hover)

  return (
    <FireSectionCard
      eyebrow="Every historical retirement"
      title={`${fmtPct(wr, 2)} withdrawals over ${years} years — ${successRate !== null ? fmtPct(successRate, 0) : "—"} of January starts survived`}
      info="Each line is one retirement cohort (real, inflation-adjusted portfolio value). Red lines ran out of money. Highlighted: 1929 crash, 1937, 1966 stagflation, 1973, 2000 dot-com, 2007 GFC."
    >
      <div className="relative" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Historical retirement paths">
          {ticks.map((t) => (
            <g key={t.m}>
              <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="var(--card-border)" strokeDasharray="3 3" />
              <text x={PAD.left - 6} y={t.y + 3} textAnchor="end" fontSize={10} fill="var(--foreground-muted)">
                {fmtCompact(t.m * portfolio)}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={PAD.left + f * (W - PAD.left - PAD.right)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--foreground-muted)">
              yr {Math.round(f * years)}
            </text>
          ))}
          {lines.filter((l) => !l.notable).map((l) => (
            <polyline
              key={l.ym}
              points={toPolyline(l.points, years)}
              fill="none"
              stroke={l.failed ? "var(--error)" : "var(--foreground-muted)"}
              strokeOpacity={hover === l.ym ? 0.9 : l.failed ? 0.45 : 0.18}
              strokeWidth={hover === l.ym ? 2 : 1}
              onMouseEnter={() => setHover(l.ym)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          {lines.filter((l) => l.notable).map((l) => (
            <polyline
              key={l.ym}
              points={toPolyline(l.points, years)}
              fill="none"
              stroke={l.failed ? "var(--error)" : "var(--warning)"}
              strokeWidth={2}
              onMouseEnter={() => setHover(l.ym)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hovered && (
          <div className="absolute top-2 right-3 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg pointer-events-none">
            <p className="font-semibold text-foreground">Retired {fmtMonth(hovered.ym)}</p>
            <p className="text-foreground-muted">
              {hovered.failed ? "Ran out of money" : `Ended with ${fmtCompact(hovered.points[hovered.points.length - 1] * portfolio)}`}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-warning inline-block" /> Notable crash starts</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-error inline-block" /> Depleted</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-foreground-muted/40 inline-block" /> Survived</span>
        <span>Values above {Y_CAP}× the start are clipped.</span>
      </div>
    </FireSectionCard>
  )
}
