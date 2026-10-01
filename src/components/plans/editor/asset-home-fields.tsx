"use client"

import { fmtMoney } from "@/components/fire/fire-helpers"
import { FireNumberField } from "@/components/fire/fire-number-field"
import { Toggle } from "@/components/fire/fire-input-controls"
import { livesIn } from "@/lib/plans/plan-asset-costs"
import { DEFAULT_RENTAL, netYearlyRent } from "@/lib/plans/plan-rentals"
import type { AssetRental, PlanAsset, PlanDocument } from "@/lib/plans/plan-types"
import { AssetHomeFallbackFields } from "./asset-home-fallback-fields"
import { GrowthField } from "./growth-field"
import { TimingPicker } from "./timing-picker"

/** A first guess at monthly rent: about 0.4% of the home's value. */
const RENT_PER_VALUE = 0.004

interface Props {
  asset: PlanAsset
  doc: PlanDocument
  onChange: (change: Partial<PlanAsset>) => void
}

/**
 * Homes: whether you live in it (home-sale exclusion, itemizable property tax and mortgage interest), or
 * rent it out (rent as income, its costs, interest and depreciation against the rent).
 */
export function AssetHomeFields({ asset, doc, onChange }: Props) {
  const rental = asset.rental
  const setRental = (change: Partial<AssetRental>) => rental && onChange({ rental: { ...rental, ...change } })
  const startRenting = () =>
    onChange({ rental: { monthlyRent: Math.round(asset.value * RENT_PER_VALUE), start: null, ...DEFAULT_RENTAL }, primaryResidence: false })
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {!rental && (
          <Toggle label="I live in it (primary residence)" checked={livesIn(asset)} onChange={(primaryResidence) => onChange({ primaryResidence })} />
        )}
        <Toggle label="Rent it out" checked={!!rental} onChange={(on) => (on ? startRenting() : onChange({ rental: undefined }))} />
      </div>
      <p className="text-[11px] text-foreground-muted">
        {rental
          ? "Rent counts as income; the home's costs, mortgage interest and depreciation come off it before tax, and selling it gets no home-sale exclusion."
          : livesIn(asset)
            ? "Selling it after 2 years excludes $250k of gain ($500k for couples); its property tax and mortgage interest can be itemized."
            : "Not your residence: no home-sale exclusion. Its property tax still counts toward SALT if you itemize."}
      </p>
      {rental && (
        <div className="space-y-2 rounded-xl border border-card-border p-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <FireNumberField label="Rent / month (today's $)" prefix="$" min={0} value={rental.monthlyRent} onChange={(monthlyRent) => setRental({ monthlyRent })} />
            <FireNumberField label="Vacancy" suffix="%" scale={100} min={0} max={1} value={rental.vacancy} onChange={(vacancy) => setRental({ vacancy })} />
            <FireNumberField label="Management fee" suffix="%" scale={100} min={0} max={1} value={rental.managementFee} onChange={(managementFee) => setRental({ managementFee })} />
            <GrowthField value={rental.growth} inflation={doc.settings.inflation} onChange={(growth) => setRental({ growth })} />
          </div>
          <TimingPicker label="Renting from" value={rental.start ?? asset.start} doc={doc} onChange={(start) => setRental({ start })} />
          <p className="text-[11px] text-foreground-muted">
            About {fmtMoney(netYearlyRent(asset))} a year collected in today&apos;s dollars, after vacancy and the manager&apos;s cut.
          </p>
        </div>
      )}
      <AssetHomeFallbackFields asset={asset} onChange={onChange} />
    </div>
  )
}
