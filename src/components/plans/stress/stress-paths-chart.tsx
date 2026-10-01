"use client"

import { useMemo, useState } from "react"
import { fmtCompact } from "@/components/fire/fire-helpers"
import { NOTABLE_PERIODS } from "@/lib/fire/fire-constants"
import type { CohortResult } from "@/lib/plans/stress/stress-test"

const W = 960
const H = 340
const PAD = { top: 12, right: 12, bottom: 24, left: 56 }
/** The y-axis tops out a bit above the 90th-percentile path, so a few boom years don't flatten the rest. */
const Y_HEADROOM = 1.15
const Y_PERCENTILE = 0.9
const TICKS = 4

interface Props {
  cohorts: CohortResult[]
  age0: number
  /** The steady-return plan, same measure, today's dollars. */
  plan: number[]
  measure: "netWorth" | "invested"
  isHidden: boolean
}

const notableLabel = new Map(NOTABLE_PERIODS.map((p) => [p.year, p.label]))

/** A rough top for the y-axis: the 90th percentile of every year's values across all paths. */
function yTop(cohorts: CohortResult[], measure: Props["measure"], plan: number[]): number {
  const values = cohorts.flatMap((c) => c[measure]).filter((v) => v > 0).sort((a, b) => a - b)
  const high = values[Math.floor(values.length * Y_PERCENTILE)] ?? 0
  return Math.max(high, ...plan, 1) * Y_HEADROOM
}

/**
 * Every historical start year as its own line (today's dollars by age), like the FIRE lab's chart: grey
 * when the money lasts, red when it runs out, crisis years highlighted, your steady plan dashed.
 */
export function StressPathsChart({ cohorts, age0, plan, measure, isHidden }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const years = Math.max(1, (cohorts[0]?.[measure].length ?? plan.length) - 1)
  const top = useMemo(() => yTop(cohorts, measure, plan), [cohorts, measure, plan])
  const x = (i: number) => PAD.left + (i / years) * (W - PAD.left - PAD.right)
  const y = (v: number) => H - PAD.bottom - (Math.max(0, Math.min(v, top)) / top) * (H - PAD.top - PAD.bottom)
  const line = (values: number[]) => values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const hovered = cohorts.find((c) => c.year === hover)
  const plain = cohorts.filter((c) => !notableLabel.has(c.year))
  const notable = cohorts.filter((c) => notableLabel.has(c.year))
  const ageTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * years))

  const path = (c: CohortResult, highlight: boolean) => {
    const failed = c.depletedAge !== null
    const active = hover === c.year
    const stroke = failed ? "var(--error)" : highlight ? "var(--warning)" : "var(--foreground-muted)"
    const opacity = active ? 0.95 : highlight ? 0.9 : failed ? 0.45 : 0.2
    return (
      <g key={c.year} onMouseEnter={() => setHover(c.year)} onMouseLeave={() => setHover(null)}>
        <polyline points={line(c[measure])} fill="none" stroke="transparent" strokeWidth={8} />
        <polyline points={line(c[measure])} fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth={active || highlight ? 2 : 1} />
      </g>
    )
  }

  return (
    <div className="relative" style={{ filter: isHidden ? "blur(8px)" : undefined }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Your plan through each historical start year">
        {Array.from({ length: TICKS + 1 }, (_, k) => (top / Y_HEADROOM) * (k / TICKS)).map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--card-border)" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--foreground-muted)">
              {fmtCompact(v)}
            </text>
          </g>
        ))}
        {ageTicks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--foreground-muted)">
            {age0 + i}
          </text>
        ))}
        {plain.map((c) => path(c, false))}
        {notable.map((c) => path(c, true))}
        <polyline points={line(plan)} fill="none" stroke="var(--foreground)" strokeOpacity={0.7} strokeDasharray="5 4" strokeWidth={1.5} pointerEvents="none" />
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute top-2 right-3 rounded-lg border border-card-border bg-card px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold text-foreground">
            Starting {hovered.year}
            {notableLabel.has(hovered.year) ? ` · ${notableLabel.get(hovered.year)}` : ""}
          </p>
          <p className={hovered.depletedAge !== null ? "text-error" : "text-foreground-muted"}>
            {hovered.depletedAge !== null ? `Money runs out at ${hovered.depletedAge}` : `Ends with ${fmtCompact(hovered[measure].at(-1) ?? 0)}`}
          </p>
          {hovered.cape !== null && <p className="text-foreground-muted">CAPE then: {hovered.cape.toFixed(1)}</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-foreground-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-warning" /> Crisis start years</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-error" /> Ran out of money</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-foreground-muted/40" /> Lasted</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 border-t-[1.5px] border-dashed border-foreground/70" /> Your plan (steady returns)</span>
        <span>Values above {fmtCompact(top)} are clipped. Hover a line for its start year.</span>
      </div>
    </div>
  )
}
