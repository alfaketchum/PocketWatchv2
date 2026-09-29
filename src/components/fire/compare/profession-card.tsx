"use client"

import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { payPosition, type PayPercentiles } from "@/lib/fire/compare-income"
import { useOccupationWages, useZipData } from "@/hooks/finance/use-fire-compare"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { FireSectionCard } from "../fire-section-card"
import { occupationBySoc } from "./occupation-picker"
import { fmtShort } from "./percentile-bar"

/** Horizontal p10–p90 range with the p25–p75 box, median tick and your position. */
interface Scale {
  lo: number
  hi: number
}

/** One shared scale for every row, so national and state ranges line up. */
function sharedScale(rows: PayPercentiles[], pay: number | null): Scale {
  const los = rows.map((b) => b.p10 ?? b.p25 ?? b.p50 ?? 0)
  const his = rows.map((b) => b.p90 ?? b.p75 ?? b.p50 ?? 1)
  return { lo: Math.min(...los, pay ?? Infinity) * 0.9, hi: Math.max(...his, pay ?? 0) * 1.05 }
}

function RangeRow({ label, bands, pay, scale, isHidden }: { label: string; bands: PayPercentiles; pay: number | null; scale: Scale; isHidden: boolean }) {
  const { lo, hi } = scale
  const x = (v: number | null) => (v === null ? null : ((v - lo) / (hi - lo || 1)) * 100)
  const pos = (v: number | null) => `${Math.min(100, Math.max(0, x(v) ?? 0))}%`
  return (
    <div className="py-2">
      <div className="flex justify-between text-[11px] text-foreground-muted mb-1.5">
        <span>{label}</span>
        <BlurredValue isHidden={isHidden}>
          <span className="tabular-nums">
            {fmtShort(bands.p10 ?? 0)} · <b className="text-foreground">{fmtShort(bands.p50 ?? 0)}</b> · {fmtShort(bands.p90 ?? 0)}
          </span>
        </BlurredValue>
      </div>
      <div className="relative h-3">
        <div className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-foreground/20" style={{ left: pos(bands.p10), right: `calc(100% - ${pos(bands.p90)})` }} />
        <div className="absolute top-0 h-3 rounded bg-primary/20" style={{ left: pos(bands.p25), right: `calc(100% - ${pos(bands.p75)})` }} />
        <div className="absolute top-0 h-3 w-0.5 bg-primary" style={{ left: pos(bands.p50) }} />
        {pay !== null && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-warning ring-2 ring-card" style={{ left: pos(pay) }} title="You" />
        )}
      </div>
    </div>
  )
}

/** Your pay vs your occupation: Census median, plus BLS percentiles nationally and in your state. */
export function ProfessionCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { compare } = state.inputs
  const occupation = occupationBySoc(compare.occupation)
  const zip = useZipData(compare.zip)
  const wages = useOccupationWages(compare.occupation, zip.data?.state ?? null)
  const pay = compare.earnedIncome

  const body = () => {
    if (!occupation) return <p className="text-sm text-foreground-muted">Pick your occupation under Your details.</p>
    const bls = wages.data?.national ?? null
    const median = bls?.p50 ?? occupation.median
    const position = pay !== null ? payPosition(pay, median, bls) : null
    const scale = sharedScale([bls, wages.data?.state].filter((b): b is PayPercentiles => !!b), pay)
    return (
      <>
        {position ? (
          <p className="text-sm text-foreground">
            You earn <b className={cn(position.multiple >= 1 ? "text-success" : "text-warning")}>{position.multiple.toFixed(2)}×</b> the median for{" "}
            {occupation.title.toLowerCase()}
            {position.percentile !== null && <> — about the <b>{Math.round(position.percentile)}th percentile</b> nationally</>}.
          </p>
        ) : (
          <p className="text-sm text-foreground-muted">Add your pay from work to see where you stand.</p>
        )}
        {wages.isLoading && <div className="h-[70px] animate-shimmer rounded-xl mt-3" />}
        {bls && <RangeRow label="United States" bands={bls} pay={pay} scale={scale} isHidden={isHidden} />}
        {wages.data?.state && <RangeRow label={zip.data?.state ?? "Your state"} bands={wages.data.state} pay={pay} scale={scale} isHidden={isHidden} />}
        {!wages.isLoading && !bls && (
          <p className="text-xs text-foreground-muted mt-2">
            Census median for full-time workers:{" "}
            <BlurredValue isHidden={isHidden}><b className="text-foreground">{fmtShort(occupation.median)}</b></BlurredValue>.{" "}
            {/X/.test(compare.occupation ?? "") ? "BLS doesn't break out this combined Census group." : "BLS percentiles unavailable right now."}
          </p>
        )}
        {bls && (
          <p className="text-[10px] text-foreground-muted mt-1">
            Line = 10th–90th percentile, box = middle half, tick = median, dot = you. BLS OEWS {wages.data?.year ?? ""}.
          </p>
        )}
      </>
    )
  }

  return (
    <FireSectionCard
      eyebrow="Pay vs. your profession"
      info="Bureau of Labor Statistics Occupational Employment and Wage Statistics (annual wages, national and your state), with the Census ACS full-time median as a fallback. Uses your pay from work — not investment income."
    >
      {body()}
    </FireSectionCard>
  )
}
