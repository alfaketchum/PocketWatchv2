"use client"

import { BlurredValue } from "@/components/portfolio/blurred-value"

export function fmtShort(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}k`
  return `${sign}$${Math.round(abs)}`
}

interface PercentileBarProps {
  /** Your position, 0–100. */
  percentile: number
  /** Labelled ticks under the bar (percentile + value). */
  marks?: { p: number; value: number }[]
  isHidden: boolean
}

/** A 0–100 track with tick labels and a "you" dot. */
export function PercentileBar({ percentile, marks = [], isHidden }: PercentileBarProps) {
  return (
    <div className="relative mt-4 mb-7 h-2 rounded-full bg-gradient-to-r from-foreground/10 to-primary/40">
      {marks.map((m) => (
        <div key={m.p} className="absolute -translate-x-1/2 top-3 text-[9px] text-foreground-muted text-center" style={{ left: `${m.p}%` }}>
          <div className="w-px h-2 bg-foreground/30 mx-auto -mt-3 mb-1" />
          p{m.p}
          <BlurredValue isHidden={isHidden}>
            <div className="tabular-nums">{fmtShort(m.value)}</div>
          </BlurredValue>
        </div>
      ))}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-card"
        style={{ left: `${Math.min(99.5, Math.max(0.5, percentile))}%` }}
        title="You"
      />
    </div>
  )
}
