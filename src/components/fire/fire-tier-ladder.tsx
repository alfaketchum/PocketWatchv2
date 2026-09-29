"use client"

import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import type { TargetProgress } from "@/lib/fire/fire-analysis"
import { fmtAge, fmtCompact, fmtMoney, fmtPct, fmtYearsAway } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

const TIER_ICONS: Record<string, string> = {
  lean: "eco",
  regular: "home",
  chubby: "restaurant",
  fat: "diamond",
  custom: "person",
}

interface TierCardProps {
  icon: string
  label: string
  spend: number
  progress: TargetProgress
  highlight: boolean
  badge?: string
  isHidden: boolean
}

function TierCard({ icon, label, spend, progress, highlight, badge, isHidden }: TierCardProps) {
  const reached = progress.years === 0
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 flex flex-col gap-2",
        highlight ? "border-primary bg-primary/5" : "border-card-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn("material-symbols-rounded", reached ? "text-success" : "text-foreground-muted")} style={{ fontSize: 16 }}>
            {reached ? "check_circle" : icon}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        </div>
        {badge && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5 whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[11px] text-foreground-muted tabular-nums">{fmtMoney(spend)}/yr spending</p>
      <BlurredValue isHidden={isHidden}>
        <p className="text-lg font-bold text-foreground tabular-nums">{fmtCompact(progress.target)}</p>
      </BlurredValue>
      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full", reached ? "bg-success" : "bg-primary")}
          style={{ width: `${Math.max(2, progress.progress * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-foreground-muted">
        <span className="text-foreground font-medium">{fmtPct(progress.progress, 0)}</span> · {fmtYearsAway(progress.years)}
        {progress.years !== null && progress.years > 0 && <> · {fmtAge(progress.age)}</>}
      </p>
    </div>
  )
}

/** Lean → Fat tiers plus the user's own target, each with target nest egg, progress and ETA. */
export function FireTierLadder({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { analysis, plan } = state

  return (
    <FireSectionCard
      eyebrow="FIRE tiers"
      title="How far you are from each lifestyle"
      info="Nest egg = yearly spending ÷ your withdrawal rate. Tier spending levels are editable in Advanced mode."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <TierCard
          icon={TIER_ICONS.custom}
          label="Your plan"
          spend={plan.annualSpend}
          progress={analysis.yourTarget}
          highlight
          badge="You"
          isHidden={isHidden}
        />
        {analysis.tiers.map((t) => (
          <TierCard
            key={t.tier.key}
            icon={TIER_ICONS[t.tier.key]}
            label={t.tier.label}
            spend={t.tier.annualSpend}
            progress={t}
            highlight={false}
            badge={analysis.currentTier === t.tier.key ? "Your tier" : undefined}
            isHidden={isHidden}
          />
        ))}
      </div>
    </FireSectionCard>
  )
}
