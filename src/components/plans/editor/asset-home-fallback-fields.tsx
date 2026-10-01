"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import type { HomeFallback, PlanAsset } from "@/lib/plans/plan-types"

/** First guesses: rent at about 0.4% of the home's value a month, or a home at 60% of its value. */
const RENT_PER_VALUE = 0.004
const SMALLER_SHARE = 0.6
const ROUND = 10_000

type Choice = "keep" | HomeFallback["then"]

const OPTIONS: { value: Choice; label: string }[] = [
  { value: "keep", label: "Keep it" },
  { value: "rent", label: "Sell it and rent" },
  { value: "smaller", label: "Sell it and buy smaller" },
]

/** A home's backup plan: if the money would run out, sell it that year and rent or buy a smaller home with cash. */
export function AssetHomeFallbackFields({ asset, onChange }: { asset: PlanAsset; onChange: (change: Partial<PlanAsset>) => void }) {
  const fallback = asset.fallback
  const choose = (then: Choice) => {
    if (then === "keep") return onChange({ fallback: undefined })
    const base = fallback ?? { monthlyRent: Math.round(asset.value * RENT_PER_VALUE), price: Math.round((asset.value * SMALLER_SHARE) / ROUND) * ROUND }
    onChange({ fallback: { ...base, then } })
  }
  const set = (change: Partial<HomeFallback>) => fallback && onChange({ fallback: { ...fallback, ...change } })
  return (
    <div className="space-y-2 border-t border-card-border/60 pt-2">
      <p className="text-[11px] font-medium text-foreground-muted">If my money runs out</p>
      <ChoiceChips label="If my money runs out" options={OPTIONS} value={fallback?.then ?? "keep"} onChange={choose} />
      {fallback && (
        <div className="grid grid-cols-2 gap-2 items-end">
          {fallback.then === "rent" ? (
            <FireNumberField label="Rent / month (today's $)" prefix="$" min={0} value={fallback.monthlyRent} onChange={(monthlyRent) => set({ monthlyRent })} />
          ) : (
            <FireNumberField label="Smaller home, paid in cash (today's $)" prefix="$" min={0} value={fallback.price} onChange={(price) => set({ price })} />
          )}
        </div>
      )}
      {fallback && (
        <p className="text-[11px] text-foreground-muted">
          Only if needed: the plan sells it in the first year your accounts can&apos;t pay the bills, pays off its loans, and{" "}
          {fallback.then === "rent" ? "you rent from then on." : "buys the smaller home with the proceeds."} The chart marks the year.
        </p>
      )}
    </div>
  )
}
