"use client"

import { useState } from "react"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { fmtPct } from "@/components/fire/fire-helpers"
import { useMarketInflation } from "@/hooks/plans/use-market-inflation"
import { usePlanMode } from "@/hooks/plans/use-plan-mode"
import { equivalentRate, marketPath, marketRateFor, marketSegments } from "@/lib/plans/plan-inflation"
import { timingContext } from "@/lib/plans/plan-timing"
import { keepRealReturns, returnBasisOf, withSettings } from "@/lib/plans/plan-returns"
import type { MarketInflation, PlanDocument, PlanSettings } from "@/lib/plans/plan-types"
import type { PlanEditorProps } from "../plans-helpers"

/** Inflation changes smaller than this don't prompt to re-base returns. */
const MIN_SHIFT = 0.0005

type Mode = NonNullable<PlanSettings["inflationMode"]>

const MODES: { value: Mode; label: string }[] = [
  { value: "custom", label: "Your number" },
  { value: "market", label: "Market" },
  { value: "marketPath", label: "Market, year by year" },
]

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

/** Settings for a mode from the market's numbers: the matching breakeven, or the path's equivalent single rate. */
function marketSettings(mode: Mode, m: MarketInflation, years: number): Partial<PlanSettings> {
  if (mode === "market") return { inflationMode: mode, marketInflation: m, inflation: marketRateFor(m, years).rate }
  return { inflationMode: mode, marketInflation: m, inflation: equivalentRate(marketPath(m, years), years) }
}

/**
 * Where the plan's inflation comes from: your own number, the bond market's expectation for the plan's
 * length (TIPS breakeven), or the market's expectation year by year. Market numbers refresh daily.
 */
export function InflationSource({ doc, update, compact }: { doc: PlanDocument; update: PlanEditorProps["update"]; compact?: boolean }) {
  const s = doc.settings
  const { isBasic } = usePlanMode()
  const set = (change: Partial<PlanSettings>) => update((d) => withSettings(d, change))
  // The inflation the account returns were entered against; changing inflation offers to keep their real value.
  const [basis, setBasis] = useState(s.inflation)
  // With returns entered after inflation they re-base on their own; only before-inflation returns need asking.
  const shift = returnBasisOf(s) === "real" ? 0 : s.inflation - basis
  const keepReal = () => {
    update((d) => keepRealReturns(d, basis, d.settings.inflation))
    setBasis(s.inflation)
  }
  const mode: Mode = s.inflationMode ?? "custom"
  const market = useMarketInflation()
  const live = market.data?.data
  const years = timingContext(doc).length
  const saved = s.marketInflation
  const stale = mode !== "custom" && live && saved && live.asOf !== saved.asOf
  const choose = (next: Mode) => {
    if (next === "custom") return set({ inflationMode: "custom" })
    if (live) set(marketSettings(next, live, years))
  }
  const horizon = saved ? marketRateFor(saved, years).horizon : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className={compact ? "w-32" : "w-40"}>
          <FireNumberField
            label="Inflation"
            suffix="%"
            scale={100}
            min={-0.05}
            max={0.2}
            value={s.inflation}
            onChange={(inflation) => set({ inflation, inflationMode: "custom" })}
          />
        </div>
        {!isBasic && <ChoiceChips label="Inflation source" options={MODES} value={mode} onChange={choose} />}
      </div>
      <p className="text-[11px] text-foreground-muted">
        {mode === "custom" && (live ? `The bond market expects about ${fmtPct(marketRateFor(live, years).rate, 2)} a year over a plan this long (TIPS breakeven, ${fmtDate(live.asOf)}).` : market.isError ? "Market inflation is unavailable right now." : "Loading what the bond market expects…")}
        {mode === "market" && saved && `${fmtPct(s.inflation, 2)}: the ${horizon}-year TIPS breakeven (what Treasury bonds pay minus inflation-protected ones), ${fmtDate(saved.asOf)}.`}
        {mode === "marketPath" && saved && `A different rate each year from the bond market's curve (${fmtDate(saved.asOf)}); ${fmtPct(s.inflation, 2)} is the single rate that ends at the same prices.`}
        {stale && (
          <button type="button" onClick={() => choose(mode)} className="ml-1 text-primary hover:underline">
            Update to {fmtDate(live.asOf)} data
          </button>
        )}
      </p>
      {!isBasic && Math.abs(shift) >= MIN_SHIFT && doc.accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-foreground">
          <span>
            Inflation went {shift < 0 ? "down" : "up"} {fmtPct(Math.abs(shift), 2)}. Account returns are before inflation, so their
            after-inflation return just went {shift < 0 ? "up" : "down"} by about as much.
          </span>
          <button type="button" onClick={keepReal} className="btn-secondary text-xs">
            Keep after-inflation returns ({shift < 0 ? "lower" : "raise"} each by {fmtPct(Math.abs(shift), 2)})
          </button>
          <button type="button" onClick={() => setBasis(s.inflation)} className="text-foreground-muted hover:text-foreground">
            Leave returns as they are
          </button>
        </div>
      )}
      {mode === "marketPath" && saved && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
          {marketSegments(saved).map((seg) => (
            <span key={seg.label} className="text-foreground-muted">
              {seg.label}: <span className="font-medium text-foreground tabular-nums">{fmtPct(seg.rate, 2)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
