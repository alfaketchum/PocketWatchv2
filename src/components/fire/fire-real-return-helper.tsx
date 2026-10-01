"use client"

import { useState } from "react"
import { useMarketInflation } from "@/hooks/plans/use-market-inflation"
import { usePlansList } from "@/hooks/plans/use-plans-list"
import { marketRateFor } from "@/lib/plans/plan-inflation"
import { realRate } from "@/lib/plans/plan-dollars"
import { fmtPct } from "./fire-helpers"
import { ChoiceChips } from "./fire-input-controls"
import { FireNumberField } from "./fire-number-field"

const DEFAULT_NOMINAL = 0.07

type Source = "plan" | "market"

const SOURCE_NAMES: Record<string, string> = { custom: "your number", market: "the bond market's rate", marketPath: "the bond market's curve" }

/**
 * FIRE works after inflation (real terms). This turns a return you think of before inflation (nominal) into a
 * real one, using what the bond market expects (TIPS breakeven, the same data Plans uses) or your primary
 * plan's inflation.
 */
export function FireRealReturnHelper({ horizonYears, onUse }: { horizonYears: number; onUse: (realReturn: number) => void }) {
  const market = useMarketInflation()
  const plans = usePlansList()
  const primary = plans.data?.plans.find((p) => p.isPrimary)?.summary
  const planRate = primary?.inflation
  const m = market.data?.data
  const marketRate = m ? marketRateFor(m, horizonYears) : null
  const [source, setSource] = useState<Source>("market")
  const [nominal, setNominal] = useState(DEFAULT_NOMINAL)
  const active: Source = source === "market" && !marketRate ? "plan" : source === "plan" && planRate === undefined ? "market" : source
  const rate = active === "plan" ? planRate : marketRate?.rate
  if (rate === undefined) return null
  const options = [
    ...(marketRate ? [{ value: "market" as const, label: `Market: ${fmtPct(marketRate.rate, 2)}` }] : []),
    ...(planRate !== undefined ? [{ value: "plan" as const, label: `Your plan: ${fmtPct(planRate, 2)}` }] : []),
  ]
  return (
    <div className="space-y-2 rounded-xl border border-card-border bg-background-secondary/40 px-3 py-2">
      <p className="text-[11px] text-foreground-muted">
        Think in returns before inflation? Convert one using{" "}
        {active === "plan"
          ? `the inflation your primary plan uses (${SOURCE_NAMES[primary?.inflationMode ?? "custom"]}).`
          : `what the bond market expects over the next ${marketRate?.horizon} years (TIPS breakeven, ${m?.asOf}).`}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {options.length > 1 && <ChoiceChips label="Inflation" options={options} value={active} onChange={setSource} />}
        <div className="w-36">
          <FireNumberField label="Return before inflation" suffix="%" scale={100} min={-0.05} max={0.3} value={nominal} onChange={setNominal} />
        </div>
        <p className="pb-2 text-xs text-foreground-muted">
          − {fmtPct(rate, 2)} inflation = <span className="font-semibold text-foreground tabular-nums">{fmtPct(realRate(nominal, rate), 2)}</span> real
        </p>
        <button type="button" onClick={() => onUse(Math.round(realRate(nominal, rate) * 10_000) / 10_000)} className="btn-secondary mb-0.5 text-xs">
          Use as real return
        </button>
      </div>
    </div>
  )
}
