"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtAge, fmtCompact, fmtMoney, fmtPct, fmtYearsAway } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

interface Milestone {
  key: string
  icon: string
  label: string
  hint: string
  target: number
  progress: number
  years: number | null
  age: number | null
  you?: boolean
  yourTier?: boolean
}

const TIER_ICONS: Record<string, string> = { lean: "eco", regular: "home", chubby: "restaurant", fat: "diamond" }

function buildMilestones(state: FirePlanState): Milestone[] {
  const { analysis, plan, inputs } = state
  const { coast, barista } = analysis
  const coastYears = coast.reached ? 0 : coast.yearsToCoast
  const rows: Milestone[] = [
    {
      key: "coast",
      icon: "sailing",
      label: "Coast FIRE",
      hint: `Enough invested that growth alone reaches your FIRE number by ${coast.coastAge} — you could stop investing.`,
      target: coast.number,
      progress: coast.number > 0 ? Math.min(1, plan.investable / coast.number) : 1,
      years: coastYears,
      age: coastYears !== null ? inputs.currentAge + coastYears : null,
    },
    {
      key: "barista",
      icon: "local_cafe",
      label: "Barista FIRE",
      hint: `Quit full-time work; ${fmtMoney(inputs.partTimeIncome)}/yr of part-time income covers the rest.`,
      target: barista.number,
      progress: barista.progress.progress,
      years: barista.progress.years,
      age: barista.progress.age,
    },
    {
      key: "you",
      icon: "person",
      label: "Your plan",
      hint: `${fmtMoney(plan.annualSpend)}/yr at a ${fmtPct(plan.swr, 2)} withdrawal rate.`,
      you: true,
      ...analysis.yourTarget,
    },
    ...analysis.tiers.map((t) => ({
      key: t.tier.key,
      icon: TIER_ICONS[t.tier.key],
      label: t.tier.label,
      hint: `${fmtMoney(t.tier.annualSpend)}/yr lifestyle.`,
      yourTier: analysis.currentTier === t.tier.key,
      target: t.target,
      progress: t.progress,
      years: t.years,
      age: t.age,
    })),
  ]
  return rows.sort((a, b) => a.target - b.target)
}

/** Every FIRE flavor as one compact, target-sorted list: target, progress, and when. */
export function FireMilestones({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const rows = useMemo(() => buildMilestones(state), [state])

  return (
    <FireSectionCard eyebrow="Milestones" info="Nest egg = yearly spending ÷ your withdrawal rate. Tap a name for what it means.">
      <ul className="divide-y divide-card-border/60">
        {rows.map((m) => {
          const done = m.years === 0
          return (
            <li key={m.key} className={cn("flex items-center gap-3 py-2.5", m.you && "bg-primary/5 -mx-2 px-2 rounded-lg")}>
              <span className={cn("material-symbols-rounded shrink-0", done ? "text-success" : m.you ? "text-primary" : "text-foreground-muted")} style={{ fontSize: 18 }}>
                {done ? "check_circle" : m.icon}
              </span>
              <div className="w-28 sm:w-36 shrink-0 min-w-0">
                <InfoTooltip content={m.hint}>
                  <span className={cn("text-sm truncate cursor-help", m.you ? "font-semibold text-primary" : "text-foreground")}>{m.label}</span>
                </InfoTooltip>
                {m.yourTier && <span className="block text-[9px] uppercase tracking-wider text-primary">your tier</span>}
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden hidden sm:block">
                <div className={cn("h-full rounded-full", done ? "bg-success" : "bg-primary")} style={{ width: `${Math.max(2, m.progress * 100)}%` }} />
              </div>
              <BlurredValue isHidden={isHidden}>
                <span className="w-16 text-right text-sm font-semibold tabular-nums text-foreground">{fmtCompact(m.target)}</span>
              </BlurredValue>
              <span className="w-28 sm:w-40 text-right text-[11px] text-foreground-muted tabular-nums">
                {done ? "Reached" : m.years === null ? "Not on this path" : `${fmtYearsAway(m.years).replace("in ", "")} · ${fmtAge(m.age)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </FireSectionCard>
  )
}
