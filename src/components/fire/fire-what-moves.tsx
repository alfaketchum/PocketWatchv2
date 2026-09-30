"use client"

import type { Lever } from "@/lib/fire/fire-sensitivity"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

function fmtDelta(years: number | null): string {
  if (years === null) return "—"
  const abs = Math.abs(years)
  if (abs < 1 / 24) return "no change"
  return abs < 1 ? `${Math.max(1, Math.round(abs * 12))} mo` : `${abs.toFixed(1)} yrs`
}

function headline(levers: Lever[]): string | null {
  const top = levers.find((l) => l.better.deltaYears !== null && l.better.deltaYears < 0)
  if (!top) return null
  return `Your biggest lever is ${top.name.toLowerCase()}: ${top.better.label.toLowerCase()} gets you there ${fmtDelta(top.better.deltaYears)} sooner.`
}

/** One tornado row: sooner (green, left of centre) and later (red, right), scaled to the largest effect. */
function LeverRow({ lever, max }: { lever: Lever; max: number }) {
  const width = (d: number | null) => `${max > 0 && d !== null ? Math.min(100, (Math.abs(d) / max) * 100) : 0}%`
  return (
    <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] items-center gap-3 py-2">
      <p className="text-sm text-foreground">{lever.name}</p>
      <div className="grid grid-cols-2">
        <div className="flex items-center justify-end gap-2 pr-1 border-r border-foreground/20">
          <span className="text-[11px] text-foreground-muted text-right leading-tight hidden sm:block">{lever.better.label}</span>
          <div className="flex-1 flex items-center justify-end gap-1.5">
            <span className="text-[11px] font-semibold text-success whitespace-nowrap tabular-nums">{fmtDelta(lever.better.deltaYears)}</span>
            <div className="h-5 rounded-l-md bg-success/70 min-w-[2px] max-w-[70%]" style={{ width: width(lever.better.deltaYears) }} />
          </div>
        </div>
        <div className="flex items-center gap-2 pl-1">
          <div className="flex-1 flex items-center gap-1.5">
            <div className="h-5 rounded-r-md bg-error/60 min-w-[2px] max-w-[70%]" style={{ width: width(lever.worse.deltaYears) }} />
            <span className="text-[11px] font-semibold text-error whitespace-nowrap tabular-nums">{fmtDelta(lever.worse.deltaYears)}</span>
          </div>
          <span className="text-[11px] text-foreground-muted leading-tight hidden sm:block">{lever.worse.label}</span>
        </div>
      </div>
    </div>
  )
}

/** "What moves your date": a tornado chart of the levers you control, ranked by impact. */
export function FireWhatMoves({ state }: { state: FirePlanState }) {
  const levers: Lever[] = state.sensitivity
  if (levers.every((l) => l.better.deltaYears === null && l.worse.deltaYears === null)) return null
  const max = Math.max(...levers.map((l) => l.impact))
  const { plan } = state
  const takeHome = plan.annualSpend + plan.annualContribution
  const lead = headline(levers)

  return (
    <FireSectionCard
      eyebrow="What moves your date"
      title={lead ?? "How sensitive your FI date is"}
      info="Each bar shows how many years sooner (green) or later (red) you'd reach FI if one thing changed and everything else stayed the same. Spending changes also change what you can invest. Sorted by impact."
    >
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-foreground-muted mb-1 pl-[100px] sm:pl-[132px]">
        <span>← Sooner</span>
        <span>Later →</span>
      </div>
      <div className="divide-y divide-card-border/50">
        {levers.map((l) => <LeverRow key={l.key} lever={l} max={max} />)}
      </div>
      {takeHome > 0 && (
        <p className="text-[11px] text-foreground-muted mt-3">You invest {fmtPct(plan.annualContribution / takeHome, 0)} of what you take home.</p>
      )}
    </FireSectionCard>
  )
}
