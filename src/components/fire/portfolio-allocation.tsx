"use client"

import { BlurredValue } from "@/components/portfolio/blurred-value"
import { ASSET_CLASSES, ASSET_CLASS_LABELS, type AssetClass } from "@/lib/fire/fire-portfolio"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtMoney, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

const CLASS_COLORS: Record<AssetClass, string> = {
  stocks: "var(--primary)",
  bonds: "var(--success)",
  cash: "var(--foreground-muted)",
  stablecoins: "color-mix(in oklab, var(--foreground-muted) 55%, var(--primary))",
  btc: "var(--warning)",
  eth: "color-mix(in oklab, var(--warning) 75%, var(--error))",
  top100: "color-mix(in oklab, var(--warning) 50%, var(--error))",
  longTail: "color-mix(in oklab, var(--warning) 25%, var(--error))",
  crypto: "var(--warning)",
}

/** Invested assets by asset class, as one stacked bar and a short table. */
export function PortfolioAllocation({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { allocation, isLoading } = state
  if (isLoading) return <div className="h-[220px] animate-shimmer rounded-2xl" />

  const rows = ASSET_CLASSES.filter((c) => allocation.byClass[c] > 0)
  const total = allocation.total

  return (
    <FireSectionCard
      eyebrow="Your portfolio"
      title={<BlurredValue isHidden={isHidden}><span>{fmtMoney(total)} invested</span></BlurredValue>}
      info="Built from your account balances and the mix you set per account below. Cash and crypto follow the include toggles in your assumptions."
    >
      {total <= 0 ? (
        <p className="text-sm text-foreground-muted">No investable accounts found yet.</p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden bg-foreground/5">
            {rows.map((c) => (
              <div key={c} style={{ width: `${(allocation.byClass[c] / total) * 100}%`, background: CLASS_COLORS[c] }} title={ASSET_CLASS_LABELS[c]} />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-card-border/60">
            {rows.map((c) => (
              <li key={c} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CLASS_COLORS[c] }} />
                <span className="flex-1 text-foreground">{ASSET_CLASS_LABELS[c]}</span>
                <BlurredValue isHidden={isHidden}>
                  <span className="tabular-nums text-foreground-muted">{fmtMoney(allocation.byClass[c])}</span>
                </BlurredValue>
                <span className="w-14 text-right tabular-nums font-semibold text-foreground">{fmtPct(allocation.byClass[c] / total, 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </FireSectionCard>
  )
}
