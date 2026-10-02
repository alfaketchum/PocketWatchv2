"use client"

import { useState } from "react"
import { toast } from "sonner"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { fetchStockPrice } from "@/hooks/plans/use-plan-import"
import { DEFAULT_STOCK_VOLATILITY, equityValueToday } from "@/lib/plans/engine/engine-equity"
import type { EquityGrant } from "@/lib/plans/plan-types"
import { FIELD_CLASS, FIELD_STYLE } from "./plan-editor-controls"

/** Ticker with a lookup: fills today's price. Private companies leave it blank and type the price (e.g. the 409A). */
function TickerField({ grant, onChange }: { grant: EquityGrant; onChange: (change: Partial<EquityGrant>) => void }) {
  const [busy, setBusy] = useState(false)
  const lookUp = async () => {
    if (!grant.symbol) return
    setBusy(true)
    try {
      const quote = await fetchStockPrice(grant.symbol)
      onChange({ symbol: quote.symbol, price: quote.price })
      toast.success(`${quote.symbol}: ${fmtMoney(quote.price)}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-foreground-muted mb-1">Ticker</span>
      <span className="flex gap-1.5">
        <input
          value={grant.symbol ?? ""}
          maxLength={10}
          placeholder="Private"
          onChange={(e) => onChange({ symbol: e.target.value.trim().toUpperCase() || null })}
          onKeyDown={(e) => e.key === "Enter" && lookUp()}
          className={`${FIELD_CLASS} uppercase`}
          style={FIELD_STYLE}
        />
        <button type="button" onClick={lookUp} disabled={!grant.symbol || busy} className="btn-secondary shrink-0 px-2 text-xs disabled:opacity-50">
          {busy ? "…" : "Get price"}
        </button>
      </span>
    </label>
  )
}

/** Shares, price and (for options) strike and volatility of an equity grant. */
export function EquityGrantFields({ grant, onChange }: { grant: EquityGrant; onChange: (change: Partial<EquityGrant>) => void }) {
  const isOption = grant.strike !== undefined
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
      <TickerField grant={grant} onChange={onChange} />
      <FireNumberField label="Price today" prefix="$" min={0} value={grant.price} onChange={(price) => onChange({ price })} />
      <FireNumberField label={isOption ? "Shares" : "Shares vesting / yr"} min={0} value={grant.shares} onChange={(shares) => onChange({ shares: Math.round(shares) })} />
      {isOption ? (
        <FireNumberField label="Strike price" prefix="$" min={0} value={grant.strike ?? 0} onChange={(strike) => onChange({ strike })} />
      ) : (
        <p className="pb-2 text-[11px] text-foreground-muted">≈ {fmtMoney(equityValueToday(grant))} a year at today&apos;s price</p>
      )}
      {isOption && (
        <div className="col-span-2 sm:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <FireNumberField
            label="Volatility / yr"
            suffix="%"
            scale={100}
            min={0}
            max={3}
            value={grant.volatility ?? DEFAULT_STOCK_VOLATILITY}
            hint="How much the stock swings in a year. Large companies 25–35%, younger tech 40–60%."
            onChange={(volatility) => onChange({ volatility })}
          />
          <p className="col-span-1 sm:col-span-3 pb-2 text-[11px] text-foreground-muted">
            Gain at today&apos;s price: {fmtMoney(equityValueToday(grant))}. The plan counts the expected gain when you exercise (an options-pricing
            estimate: the stock could end well above the strike or below it, where the option pays nothing). The stress test replays each market instead.
          </p>
        </div>
      )}
    </div>
  )
}
