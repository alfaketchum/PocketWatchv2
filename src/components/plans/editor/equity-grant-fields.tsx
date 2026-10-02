"use client"

import { useState } from "react"
import { toast } from "sonner"
import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { fetchStockPrice } from "@/hooks/plans/use-plan-import"
import { DEFAULT_STOCK_VOLATILITY, equityValueToday } from "@/lib/plans/engine/engine-equity"
import { defaultVesting } from "@/lib/plans/plan-vesting"
import type { EquityGrant } from "@/lib/plans/plan-types"
import { FIELD_CLASS, FIELD_STYLE } from "./plan-editor-controls"
import { VestingFields } from "./vesting-fields"

/** Older RSUs were shares a year; a schedule's grant is the whole thing, over its years. */
const LEGACY_GRANT_YEARS = 4

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

/** RSUs: the vesting schedule, or (older RSUs entered as shares a year) a way to switch to one. */
function RsuVesting({ grant, firstYear, onChange }: { grant: EquityGrant; firstYear: number; onChange: (change: Partial<EquityGrant>) => void }) {
  if (grant.vesting) {
    const vesting = grant.vesting
    return <VestingFields vesting={vesting} shares={grant.shares} firstYear={firstYear} onChange={(change) => onChange({ vesting: { ...vesting, ...change } })} />
  }
  const convert = () => onChange({ shares: grant.shares * LEGACY_GRANT_YEARS, vesting: defaultVesting(new Date().getMonth() + 1) })
  return (
    <button type="button" onClick={convert} className="text-[11px] text-primary hover:underline">
      Set a vesting schedule (cliff, uneven years, refreshers)
    </button>
  )
}

/** Shares, price and (for options) strike and volatility of an equity grant; RSUs add their vesting. */
export function EquityGrantFields({ grant, firstYear, onChange }: { grant: EquityGrant; firstYear: number; onChange: (change: Partial<EquityGrant>) => void }) {
  const isOption = grant.strike !== undefined
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <TickerField grant={grant} onChange={onChange} />
        <FireNumberField label="Price today" prefix="$" min={0} value={grant.price} onChange={(price) => onChange({ price })} />
        <FireNumberField label={isOption ? "Shares" : grant.vesting ? "Shares granted" : "Shares vesting / yr"} min={0} value={grant.shares} onChange={(shares) => onChange({ shares: Math.round(shares) })} />
        {isOption ? (
          <FireNumberField label="Strike price" prefix="$" min={0} value={grant.strike ?? 0} onChange={(strike) => onChange({ strike })} />
        ) : (
          <p className="pb-2 text-[11px] text-foreground-muted">
            ≈ {fmtMoney(equityValueToday(grant))} a year at today&apos;s price{grant.vesting && !grant.vesting.refresh ? ", on average" : ""}
          </p>
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
      {!isOption && <RsuVesting grant={grant} firstYear={firstYear} onChange={onChange} />}
    </div>
  )
}
