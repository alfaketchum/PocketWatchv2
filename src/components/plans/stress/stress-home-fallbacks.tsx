"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { fallbackHomes } from "@/lib/plans/plan-home-fallback"
import type { HomeFallback, PlanAsset } from "@/lib/plans/plan-types"
import { patchItem, type PlanEditorProps } from "../plans-helpers"
import { Setting } from "./stress-controls"

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

const INFO =
  "What happens to each home in a trial where your accounts can't pay a year's bills. Kept, it's never sold, so a trial can run out of money with its equity untouched. Sold, it goes that year, its loans are paid off from the sale, and you rent or buy a smaller home with cash from then on; those trials count as \"Lasted by selling the home\". Changing it re-runs the test."

/** The first-guess backup plan when one is turned on. */
const defaultFallback = (home: PlanAsset, then: HomeFallback["then"]): HomeFallback => ({
  then,
  monthlyRent: Math.round(home.value * RENT_PER_VALUE),
  price: Math.round((home.value * SMALLER_SHARE) / ROUND) * ROUND,
})

function HomeRow({ home, onChange }: { home: PlanAsset; onChange: (fallback: HomeFallback | undefined) => void }) {
  const fallback = home.fallback
  const choose = (then: Choice) => onChange(then === "keep" ? undefined : { ...(fallback ?? defaultFallback(home, then)), then })
  const set = (change: Partial<HomeFallback>) => fallback && onChange({ ...fallback, ...change })
  return (
    <li className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <span className="inline-flex min-h-9 w-full items-center gap-1.5 text-xs font-medium text-foreground sm:w-auto sm:min-w-32 md:min-h-8">
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 15 }} aria-hidden="true">
          home
        </span>
        <span className="truncate">{home.name}</span>
      </span>
      <ChoiceChips label={`If the money runs out: ${home.name}`} options={OPTIONS} value={fallback?.then ?? "keep"} onChange={choose} />
      {fallback && (
        <div className="w-44">
          {fallback.then === "rent" ? (
            <FireNumberField label="Rent / month (today's $)" prefix="$" min={0} value={fallback.monthlyRent} onChange={(monthlyRent) => set({ monthlyRent })} />
          ) : (
            <FireNumberField label="Smaller home, cash (today's $)" prefix="$" min={0} value={fallback.price} onChange={(price) => set({ price })} />
          )}
        </div>
      )}
    </li>
  )
}

/** The stress test setting for each home: kept, or sold to keep the money going if it runs out. */
export function StressHomeFallbacks({ doc, update }: Pick<PlanEditorProps, "doc" | "update">) {
  const homes = fallbackHomes(doc)
  if (homes.length === 0) return null
  const setFallback = (id: string, fallback: HomeFallback | undefined) => update((d) => ({ ...d, assets: patchItem(d.assets, id, { fallback }) }))
  return (
    <Setting label="If the money runs out" info={INFO}>
      <ul className="space-y-2">
        {homes.map((home) => (
          <HomeRow key={home.id} home={home} onChange={(fallback) => setFallback(home.id, fallback)} />
        ))}
      </ul>
    </Setting>
  )
}
