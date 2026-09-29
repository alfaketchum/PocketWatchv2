"use client"

import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { millionaireNextDoor, type WealthLabel } from "@/lib/fire/compare-income"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { FireSectionCard } from "../fire-section-card"
import { householdIncomeOf } from "./compare-details"
import { fmtShort } from "./percentile-bar"

/** Gauge runs 0 → 3× expected wealth. */
const GAUGE_MAX = 3
const TICKS = [
  { at: 0.5, label: "½× under" },
  { at: 1, label: "1×" },
  { at: 2, label: "2× prodigious" },
]

const LABELS: Record<WealthLabel, { name: string; tone: string }> = {
  PAW: { name: "Prodigious accumulator of wealth", tone: "text-success" },
  AAW: { name: "Average accumulator of wealth", tone: "text-warning" },
  UAW: { name: "Under accumulator of wealth", tone: "text-error" },
}

/** Stanley & Danko's "Millionaire Next Door" test: net worth vs age × income ÷ 10. */
export function MillionaireCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { inputs, baseline } = state
  const income = householdIncomeOf(state)
  const score = income !== null ? millionaireNextDoor(inputs.currentAge, income, baseline.netWorth) : null

  return (
    <FireSectionCard
      eyebrow="Millionaire Next Door"
      info="From Stanley & Danko: expected net worth = age × pre-tax household income from all sources (except inheritance) ÷ 10. Twice that or more makes you a prodigious accumulator; half or less, an under accumulator."
    >
      {!score ? (
        <p className="text-sm text-foreground-muted">Add your household income under Your details.</p>
      ) : (
        <>
          <p className={cn("text-2xl font-bold tabular-nums", LABELS[score.label].tone)}>{score.ratio.toFixed(1)}×</p>
          <p className="text-sm text-foreground">
            {LABELS[score.label].name}. Expected for your age and income:{" "}
            <BlurredValue isHidden={isHidden}>
              <b className="tabular-nums">{fmtShort(score.expected)}</b>
            </BlurredValue>
            .
          </p>
          <div className="relative mt-4 mb-6 h-2 rounded-full overflow-hidden flex">
            <div className="h-full bg-error/40" style={{ width: `${(0.5 / GAUGE_MAX) * 100}%` }} />
            <div className="h-full bg-warning/40" style={{ width: `${(1.5 / GAUGE_MAX) * 100}%` }} />
            <div className="h-full bg-success/40 flex-1" />
          </div>
          <div className="relative -mt-8 h-2">
            <div
              className="absolute top-0 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-card"
              style={{ left: `${Math.min(99, (Math.max(0, score.ratio) / GAUGE_MAX) * 100)}%` }}
              title="You"
            />
          </div>
          <div className="relative h-4 mt-3 text-[9px] text-foreground-muted">
            {TICKS.map((t) => (
              <span key={t.at} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(t.at / GAUGE_MAX) * 100}%` }}>
                {t.label}
              </span>
            ))}
          </div>
        </>
      )}
    </FireSectionCard>
  )
}
