"use client"

import type { CreditScoreItem } from "@/hooks/finance/use-credit-scores"
import { BUREAUS, modelLabel, scoreTier, SCORE_TIERS, MIN_SCORE, MAX_SCORE } from "@/lib/finance/credit-scores"
import { cn } from "@/lib/utils"
import { fmtScoreDate, scoreChanges, signed } from "./credit-helpers"

function Change({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-[11px] text-foreground-muted">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", value === null ? "text-foreground-muted" : value > 0 ? "text-success" : value < 0 ? "text-error" : "text-foreground")}>
        {value === null ? "—" : signed(value)}
      </div>
    </div>
  )
}

/** Where a score sits on the 300–850 scale, with FICO's ranges marked. */
function ScaleBar({ score }: { score: number }) {
  const at = ((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100
  return (
    <div className="space-y-1">
      <div className="relative flex h-2 gap-[2px]">
        {SCORE_TIERS.map((t) => (
          <span key={t.key} className="h-full rounded-[3px] bg-foreground/10" style={{ flex: t.max - t.min + 1 }} />
        ))}
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary" style={{ left: `${at}%` }} />
      </div>
      <div className="flex text-[10px] text-foreground-muted">
        {SCORE_TIERS.map((t) => (
          <span key={t.key} style={{ flex: t.max - t.min + 1 }} className="truncate">
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The latest score, its range, and how it has moved. */
export function CreditScoreHero({ scores }: { scores: CreditScoreItem[] }) {
  const latest = scores[0]
  const tier = scoreTier(latest.score)
  const { sinceLast, overYear } = scoreChanges(scores)
  const bureau = BUREAUS.find((b) => b.value === latest.bureau)?.label
  return (
    <section className="card p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Latest score</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums text-foreground">{latest.score}</span>
            <span className="text-sm font-medium text-foreground">{tier.label}</span>
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            {modelLabel(latest.model)}
            {bureau && ` · ${bureau}`} · checked {fmtScoreDate(latest.date)}
          </p>
        </div>
        <div className="flex gap-6">
          <Change label="Since last check" value={sinceLast} />
          <Change label="Over 12 months" value={overYear} />
        </div>
      </div>
      <ScaleBar score={latest.score} />
    </section>
  )
}
