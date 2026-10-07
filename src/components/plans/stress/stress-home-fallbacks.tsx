"use client"

import { ChoiceChips } from "@/components/fire/fire-input-controls"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { livesIn } from "@/lib/plans/plan-asset-costs"
import { homeUse, type HomeUse } from "@/lib/plans/plan-rentals"
import { defaultFallback, fallbackHomes, planHousingRent, plannedSaleIndex } from "@/lib/plans/plan-home-fallback"
import type { HomeFallback, PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import { patchItem, type PlanEditorProps } from "../plans-helpers"
import { Setting } from "./stress-controls"

type Choice = HomeFallback["then"]

const LABELS: Record<Choice, string> = { keep: "Keep it", rent: "Sell it and rent", smaller: "Sell it and buy smaller", sell: "Sell it" }

/**
 * The home you live in is sold and replaced (rent, or a smaller home); a second home or a rental is simply sold.
 * A choice already made stays listed.
 */
function optionsFor(home: PlanAsset): { value: Choice; label: string }[] {
  const choices: Choice[] = livesIn(home) ? ["keep", "rent", "smaller"] : ["keep", "sell"]
  const current = home.fallback?.then
  if (current && !choices.includes(current)) choices.push(current)
  return choices.map((value) => ({ value, label: LABELS[value] }))
}

const INFO =
  "What happens to each home in a trial where your portfolio is depleted and a year's spending goes unfunded. Kept, it's never sold, so a trial's portfolio can be depleted with its equity untouched. Sold, it goes that year and its loans are paid off from the proceeds; for the home you live in you then rent or buy a smaller home with cash, while a second home or a rental is simply sold and its costs stop; those trials count as \"Funded by a home sale\". A home your plan already sells keeps that sale, but in a trial where the portfolio is depleted first it's sold that year instead. A home you live in starts on Sell it and rent, at your plan's Housing costs (or about 0.4% of its value a month when it has none), until you choose otherwise. Only the stress test sells a home this way; your plan itself never does. Changing it re-runs the test."

/** The first-guess backup plan when one is turned on. */

const USE_CHIPS: Record<HomeUse, { label: string; title: string } | null> = {
  rented: { label: "Rented out in your plan", title: "Your plan collects rent on it (set on Assets & debts); a sale here ends the rent too" },
  live: { label: "You live in it", title: "Your plan has you living in it (set on Assets & debts)" },
  other: null,
}

/** The home's name, and a chip saying how the plan uses it (rented out, or lived in). */
function HomeName({ home }: { home: PlanAsset }) {
  const chip = USE_CHIPS[homeUse(home)]
  return (
    <span className="inline-flex min-h-9 w-full flex-wrap items-center gap-1.5 text-xs font-medium text-foreground sm:w-auto sm:min-w-32 md:min-h-8">
      <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 15 }} aria-hidden="true">
        home
      </span>
      <span className="truncate">{home.name}</span>
      {chip && (
        <span title={chip.title} className="rounded-full border border-card-border bg-background-secondary px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
          {chip.label}
        </span>
      )}
    </span>
  )
}

/** A home the plan sells itself: nothing to choose, but trials that run short first sell it sooner. */
function PlannedSaleRow({ home, year }: { home: PlanAsset; year: number }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <HomeName home={home} />
      <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
        <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
          lock
        </span>
        Sold in your plan in {year} · sooner in trials where the portfolio is depleted first
      </span>
    </li>
  )
}

/**
 * One home's choice. With none made, a home you live in shows (and the stress test uses) Sell it and rent, at the
 * plan's own Housing costs when it has any; a Keep you pick is saved, so the default never overrides it.
 */
function HomeRow({ home, doc, onChange }: { home: PlanAsset; doc: PlanDocument; onChange: (fallback: HomeFallback) => void }) {
  const fallback = home.fallback ?? defaultFallback(home, livesIn(home) ? "rent" : "keep", doc)
  const fromPlan = !home.fallback && planHousingRent(doc) !== null
  const choose = (then: Choice) => onChange({ ...fallback, then })
  const set = (change: Partial<HomeFallback>) => onChange({ ...fallback, ...change })
  return (
    <li className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <HomeName home={home} />
      <ChoiceChips label={`If the portfolio is depleted: ${home.name}`} options={optionsFor(home)} value={fallback.then} onChange={choose} />
      {fallback.then !== "keep" && fallback.then !== "sell" && (
        <div className="w-44">
          {fallback.then === "rent" ? (
            <FireNumberField
              label={fromPlan ? "Rent / month (your plan's Housing costs)" : "Rent / month (today's $)"}
              prefix="$"
              min={0}
              value={fallback.monthlyRent}
              onChange={(monthlyRent) => set({ monthlyRent })}
            />
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
  const setFallback = (id: string, fallback: HomeFallback) => update((d) => ({ ...d, assets: patchItem(d.assets, id, { fallback }) }))
  return (
    <Setting label="If the portfolio is depleted" info={INFO}>
      <ul className="space-y-2">
        {homes.map((home) => {
          const sold = plannedSaleIndex(doc, home)
          return sold !== null ? (
            <PlannedSaleRow key={home.id} home={home} year={doc.settings.startYear + sold} />
          ) : (
            <HomeRow key={home.id} home={home} doc={doc} onChange={(fallback) => setFallback(home.id, fallback)} />
          )
        })}
      </ul>
    </Setting>
  )
}
