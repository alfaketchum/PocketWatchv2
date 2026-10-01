import type { HomeData } from "./types"

/** The facts kept on a home from a lookup, shown on its card. */
export type HomeDetailsSnapshot = HomeData["details"] & Pick<HomeData, "valueRange" | "assessedValue" | "lastSale" | "effectiveTaxRate">

export interface HomeLookupFields {
  address: string
  value: number
  propertyTaxAnnual: number | null
  rentEstimate: number | null
  homeDetails: HomeDetailsSnapshot
  dataSource: string
  dataAsOf: string
  purchasePrice?: number
  purchaseDate?: string
}

/** What a lookup sets on a home: value, tax bill, rent, facts, and the last sale as its purchase if none was entered. */
export function homeDataToAsset(home: HomeData, current: { purchasePrice?: number | null }, today = new Date()): HomeLookupFields {
  return {
    address: home.address,
    value: Math.round(home.value),
    propertyTaxAnnual: home.propertyTax?.amount ?? null,
    rentEstimate: home.rentEstimate,
    homeDetails: {
      ...home.details,
      valueRange: home.valueRange,
      assessedValue: home.assessedValue,
      lastSale: home.lastSale,
      effectiveTaxRate: home.effectiveTaxRate,
    },
    dataSource: home.source,
    dataAsOf: today.toISOString().slice(0, 10),
    ...(current.purchasePrice == null && home.lastSale ? { purchasePrice: home.lastSale.price, purchaseDate: home.lastSale.date } : {}),
  }
}
