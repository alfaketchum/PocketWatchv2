"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { constantEquity, failsafe, successRate, summarizeCohorts } from "@/lib/fire/swr-simulation"
import type { FirePlanState } from "@/hooks/finance/use-fire-plan"
import { fmtPct, fmtSuccess } from "./fire-helpers"
import { FireSectionCard } from "./fire-section-card"

/** ERN's reference allocation for long retirements. */
const ERN_STOCKS = 0.75
/** Cash cushion band ERN's bucket/cash-cushion posts treat as reasonable, in years of spending. */
const RUNWAY_LOW = 0.25
const RUNWAY_HIGH = 3

type Tone = "good" | "warn" | "info"

interface Check {
  key: string
  icon: string
  label: string
  text: string
  tone: Tone
}

const TONE_CLASS: Record<Tone, string> = { good: "text-success", warn: "text-warning", info: "text-foreground-muted" }

function runwayCheck(years: number | null): Check {
  const text =
    years === null
      ? "Add spending data to size your cash cushion."
      : `${years.toFixed(1)} years of spending sits in cash and stablecoins.` +
        (years > RUNWAY_HIGH ? " ERN: beyond ~3 years, cash mostly drags on returns." : years < RUNWAY_LOW ? " A small cushion lets you avoid selling stocks in a crash." : " A reasonable cushion against an early crash.")
  const tone: Tone = years === null ? "info" : years > RUNWAY_HIGH || years < RUNWAY_LOW ? "warn" : "good"
  return { key: "runway", icon: "savings", label: "Cash runway", text, tone }
}

/** Your real mix checked against ERN's research: allocation, cash cushion, and crypto concentration. */
export function PortfolioRiskChecks({ state }: { state: FirePlanState }) {
  const { history, simOptions, allocation, plan } = state

  const checks = useMemo<Check[]>(() => {
    const out: Check[] = []
    if (history && allocation.total > 0) {
      const mine = { ...simOptions, equity: constantEquity(allocation.sim.stocks, allocation.sim.cash) }
      const ern = { ...simOptions, equity: constantEquity(ERN_STOCKS) }
      const mineWr = failsafe(summarizeCohorts(history, mine))?.wr ?? null
      const ernWr = failsafe(summarizeCohorts(history, ern))?.wr ?? null
      const mineOk = successRate(history, plan.swr, mine)
      const ernOk = successRate(history, plan.swr, ern)
      const behind = mineWr !== null && ernWr !== null && mineWr < ernWr - 0.001
      out.push({
        key: "mix",
        icon: "balance",
        label: `Your mix vs ERN's ${Math.round(ERN_STOCKS * 100)}/${Math.round((1 - ERN_STOCKS) * 100)}`,
        text: `Yours (${fmtPct(allocation.sim.stocks, 0)} stocks, ${fmtPct(allocation.sim.cash, 0)} cash): ${fmtPct(mineWr, 2)} failsafe, ${fmtSuccess(mineOk)} success. ERN's: ${fmtPct(ernWr, 2)}, ${fmtSuccess(ernOk)}.`,
        tone: behind ? "warn" : "good",
      })
    }
    out.push(runwayCheck(allocation.cashRunwayYears))
    return out
  }, [history, simOptions, allocation, plan])

  return (
    <FireSectionCard eyebrow="Risk checks" info="Based on Big ERN's SWR series: asset allocation (parts 19–20), cash cushions and buckets (12, 48). Crypto is stress-tested separately below.">
      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.key} className="flex gap-3">
            <span className={cn("material-symbols-rounded shrink-0 mt-0.5", TONE_CLASS[c.tone])} style={{ fontSize: 18 }}>{c.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-foreground-muted">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </FireSectionCard>
  )
}
