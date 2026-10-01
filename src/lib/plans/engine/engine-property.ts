/**
 * A year of owning homes, for tax: property tax and mortgage interest on homes you keep for yourself are
 * itemizable; a rented home's costs, interest and depreciation come off its rent instead.
 */

import { livesIn } from "../plan-asset-costs"
import { isHomeLoanInterest } from "../plan-debt-payments"
import { BUILDING_SHARE, RENTAL_DEPRECIATION_YEARS, rentIncomeId } from "../plan-rentals"
import { resolveTiming, type TimingContext } from "../plan-timing"
import type { PlanAsset, PlanDocument } from "../plan-types"
import type { Itemized } from "../tax/itemized-2026"
import { assetBasis, isOwned, type AssetEntry } from "./engine-assets"

export interface PropertyYear {
  itemized: Itemized
  /** Rent left after the rented homes' costs, interest and depreciation (losses aren't used: passive). */
  rentalTaxable: number
}

interface PropertyInputs {
  doc: PlanDocument
  ctx: TimingContext
  assets: AssetEntry[]
  index: number
  year: number
  expensesById: Record<string, number>
  incomeById: Record<string, number>
  /** This year's interest by debt id, and each debt's balance going into the year. */
  interestBy: Record<string, number>
  balanceBy: Record<string, number>
}

/** The plan year a home starts being rented, or null when it isn't. */
function rentalStart(asset: PlanAsset, entry: AssetEntry | undefined, ctx: TimingContext): number | null {
  if (!asset.rental) return null
  const start = asset.rental.start ? resolveTiming(asset.rental.start, ctx) : null
  return Math.max(entry?.range.start ?? 0, start ?? entry?.range.start ?? 0, 0)
}

function rentedIn(asset: PlanAsset, entry: AssetEntry | undefined, ctx: TimingContext, index: number): boolean {
  const start = rentalStart(asset, entry, ctx)
  return start !== null && index >= start && (!entry || isOwned(entry.range, index))
}

/** Straight-line depreciation of the building over 27.5 years from when renting starts. */
function depreciation(entry: AssetEntry | undefined, start: number | null, index: number): number {
  if (!entry || start === null || index - start >= RENTAL_DEPRECIATION_YEARS) return 0
  return (assetBasis(entry) * BUILDING_SHARE) / RENTAL_DEPRECIATION_YEARS
}

export function propertyYear(p: PropertyInputs): PropertyYear {
  const byId = new Map(p.doc.assets.map((a) => [a.id, a]))
  const entryOf = (id: string) => p.assets.find((e) => e.asset.id === id)
  const rented = (asset: PlanAsset | undefined) => !!asset && rentedIn(asset, entryOf(asset.id), p.ctx, p.index)
  const rentalCosts: Record<string, number> = {}
  let propertyTax = 0
  let residenceTax = 0
  for (const e of p.doc.expenses) {
    const asset = e.costOf ? byId.get(e.costOf.assetId) : undefined
    const amount = p.expensesById[e.id] ?? 0
    if (!asset || !e.costOf || amount <= 0) continue
    if (rented(asset)) rentalCosts[asset.id] = (rentalCosts[asset.id] ?? 0) + amount
    else if (e.costOf.propertyTax) {
      propertyTax += amount
      if (livesIn(asset)) residenceTax += amount
    }
  }
  let mortgageInterest = 0
  let mortgageDebt = 0
  for (const d of p.doc.debts) {
    const interest = p.interestBy[d.id] ?? 0
    const asset = d.assetId ? byId.get(d.assetId) : undefined
    if (interest <= 0) continue
    if (rented(asset)) rentalCosts[asset!.id] = (rentalCosts[asset!.id] ?? 0) + interest
    else if ((d.kind === "mortgage" || asset?.kind === "home") && isHomeLoanInterest(d)) {
      mortgageInterest += interest
      mortgageDebt += p.balanceBy[d.id] ?? 0
    }
  }
  let rentalTaxable = 0
  for (const asset of p.doc.assets) {
    if (!rented(asset)) continue
    const entry = entryOf(asset.id)
    const rent = p.incomeById[rentIncomeId(asset.id)] ?? 0
    const dep = depreciation(entry, rentalStart(asset, entry, p.ctx), p.index)
    rentalTaxable += Math.max(0, rent - (rentalCosts[asset.id] ?? 0) - dep)
  }
  return { itemized: { year: p.year, propertyTax, residenceTax, mortgageInterest, mortgageDebt }, rentalTaxable }
}
