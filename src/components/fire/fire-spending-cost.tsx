"use client"

import Link from "next/link"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtCompact, fmtMoney, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

function fmtSooner(years: number | null): string {
  if (years === null) return "—"
  if (years < 1 / 12) return "< 1 mo sooner"
  if (years < 1) return `${Math.round(years * 12)} mo sooner`
  return `${years.toFixed(1)} yrs sooner`
}

/** Top spending categories translated into FIRE terms: nest egg required and time to FI. */
export function FireSpendingCost({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { spendingCosts, plan } = state
  if (spendingCosts.length === 0) return null

  const totalNestEgg = spendingCosts.reduce((s, c) => s + c.nestEgg, 0)

  return (
    <FireSectionCard
      eyebrow="What your spending costs"
      title={
        <BlurredValue isHidden={isHidden}>
          <span>Your top {spendingCosts.length} categories need {fmtCompact(totalNestEgg)} of your nest egg</span>
        </BlurredValue>
      }
      info={`Every $100/mo of spending needs ${fmtMoney(1200 / plan.swr)} invested at ${fmtPct(plan.swr, 2)}. "Sooner" = if you cut the category and invested the money instead.`}
      right={<Link href="/finance/budgets" className="text-[11px] font-medium text-primary hover:underline">Budgets →</Link>}
    >
      <ul className="divide-y divide-card-border/60">
        {spendingCosts.map((c) => (
          <li key={c.category} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="flex-1 min-w-0">
              <p className="truncate text-foreground">{c.category}</p>
              <BlurredValue isHidden={isHidden}>
                <p className="sm:hidden text-[11px] tabular-nums text-foreground-muted">{fmtMoney(c.monthly)}/mo</p>
              </BlurredValue>
            </div>
            <BlurredValue isHidden={isHidden}>
              <span className="hidden sm:inline-block w-20 text-right tabular-nums text-foreground-muted">{fmtMoney(c.monthly)}/mo</span>
            </BlurredValue>
            <BlurredValue isHidden={isHidden}>
              <span className="w-16 text-right tabular-nums font-semibold text-foreground">+{fmtCompact(c.nestEgg)}</span>
            </BlurredValue>
            <span className="w-24 sm:w-28 text-right text-[11px] tabular-nums text-success">{fmtSooner(c.yearsSooner)}</span>
          </li>
        ))}
      </ul>
    </FireSectionCard>
  )
}
