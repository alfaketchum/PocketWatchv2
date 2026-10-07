import type { PlanAsset, PlanDocument, PlanIncome } from "./plan-types"

const MONTHS = 12
/** Residential rental buildings are depreciated over 27.5 years. */
export const RENTAL_DEPRECIATION_YEARS = 27.5
/** Share of a home's basis that's the building (land isn't depreciated). */
export const BUILDING_SHARE = 0.8

export const DEFAULT_RENTAL = { vacancy: 0.05, managementFee: 0.08, growth: null } as const

export const rentIncomeId = (assetId: string) => `rent-${assetId}`

/** A first guess at monthly rent: about 0.4% of the home's value. */
const RENT_PER_VALUE = 0.004

/** How a home is used: you live in it, it's rented out, or neither (a second home, held empty). */
export type HomeUse = "live" | "rented" | "other"

export function homeUse(asset: Pick<PlanAsset, "kind" | "rental" | "primaryResidence" | "acquired">): HomeUse {
  if (asset.rental) return "rented"
  return (asset.primaryResidence ?? asset.acquired !== "received") ? "live" : "other"
}

/** The change that gives a home that use; renting it starts at a typical rent for its value. */
export function withHomeUse(asset: Pick<PlanAsset, "value" | "rental">, use: HomeUse): Partial<PlanAsset> {
  if (use === "rented") return { rental: asset.rental ?? { monthlyRent: Math.round(asset.value * RENT_PER_VALUE), start: null, ...DEFAULT_RENTAL }, primaryResidence: false }
  return { rental: undefined, primaryResidence: use === "live" }
}

/** Rent actually collected in a year, today's dollars: 12 months less vacancy and the manager's cut. */
export function netYearlyRent(asset: Pick<PlanAsset, "rental">): number {
  const r = asset.rental
  if (!r) return 0
  return r.monthlyRent * MONTHS * (1 - r.vacancy) * (1 - r.managementFee)
}

/**
 * Rent from homes that are rented out, as income for the years they're rented. Not taxable as listed:
 * the engine taxes the rent left after the home's costs, mortgage interest and depreciation.
 */
export function rentalIncomes(doc: PlanDocument): PlanIncome[] {
  const existing = new Set(doc.incomes.map((i) => i.id))
  return doc.assets.flatMap((asset): PlanIncome[] => {
    const id = rentIncomeId(asset.id)
    if (!asset.rental || existing.has(id) || netYearlyRent(asset) <= 0) return []
    return [
      {
        id,
        name: `${asset.name} rent`,
        kind: "rental",
        amount: netYearlyRent(asset),
        growth: asset.rental.growth,
        start: asset.rental.start ?? asset.start,
        end: asset.end,
        taxable: false,
        oneTime: false,
        contributions: [],
      },
    ]
  })
}
