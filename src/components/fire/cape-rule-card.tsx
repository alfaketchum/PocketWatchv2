"use client"

import { capeWithdrawalRate } from "@/lib/fire/cape-rule"
import { SWR_PRESET_RATES } from "@/lib/fire/fire-constants"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { fmtMoney, fmtMonth, fmtPct } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

/** Today's CAPE-based withdrawal rate vs fixed rules, in dollars on the user's portfolio. */
export function CapeRuleCard({ state, isHidden }: { state: FirePlanState; isHidden: boolean }) {
  const { history, inputs, plan } = state
  if (!history) return <div className="h-[180px] animate-shimmer rounded-2xl" />

  const capeWr = capeWithdrawalRate(history.latestCape, inputs.capeA, inputs.capeB)
  const portfolio = plan.investable
  const rows = [
    { label: `CAPE rule (${fmtPct(inputs.capeA, 2)} + ${inputs.capeB} ÷ CAPE)`, wr: capeWr, highlight: true },
    { label: "4% rule", wr: SWR_PRESET_RATES["4"], highlight: false },
    { label: "3.5% (ERN early-retiree)", wr: SWR_PRESET_RATES["3.5"], highlight: false },
  ]

  return (
    <FireSectionCard
      eyebrow="CAPE-based withdrawals"
      title={`Shiller CAPE is ${history.latestCape.toFixed(1)} (${fmtMonth(history.latestCapeMonth)})`}
      info="Big ERN: every failure of the 4% rule started when CAPE was elevated. His CAPE rule scales withdrawals with the market's earnings yield (1/CAPE) and recalculates each year."
    >
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
              r.highlight ? "bg-primary/10" : "bg-foreground/[0.03]",
            )}
          >
            <span className={cn(r.highlight ? "text-primary font-semibold" : "text-foreground")}>{r.label}</span>
            <span className="tabular-nums text-foreground">
              <b>{fmtPct(r.wr, 2)}</b>
              <BlurredValue isHidden={isHidden}>
                <span className="text-foreground-muted"> · {fmtMoney(portfolio * r.wr)}/yr</span>
              </BlurredValue>
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-foreground-muted mt-3">
        At today&apos;s valuations the CAPE rule implies a {fmtMoney(plan.annualSpend / capeWr)} nest egg for your{" "}
        {fmtMoney(plan.annualSpend)}/yr spending.
      </p>
    </FireSectionCard>
  )
}
