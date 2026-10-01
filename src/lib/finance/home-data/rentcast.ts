/**
 * RentCast (rentcast.io): property records (facts, sales, assessments, tax bills) plus value and rent
 * estimates by address. Three requests per lookup.
 */

import type { HomeData, HomeDataProvider } from "./types"

const BASE = "https://api.rentcast.io/v1"
const TIMEOUT_MS = 15_000

/** Fields we read from a RentCast property record. */
export interface RentcastProperty {
  formattedAddress?: string
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  yearBuilt?: number
  lastSaleDate?: string
  lastSalePrice?: number
  hoa?: { fee?: number }
  taxAssessments?: Record<string, { year?: number; value?: number }>
  propertyTaxes?: Record<string, { year?: number; total?: number }>
}

export interface RentcastValue {
  price?: number
  priceRangeLow?: number
  priceRangeHigh?: number
}

export interface RentcastRent {
  rent?: number
}

/** The most recent year's entry in a by-year record. */
function latest<T extends { year?: number }>(byYear: Record<string, T> | undefined): (T & { year: number }) | null {
  const entries = Object.entries(byYear ?? {}).map(([k, v]) => ({ ...v, year: v.year ?? Number(k) }))
  return entries.sort((a, b) => b.year - a.year)[0] ?? null
}

/** RentCast's three responses as one HomeData; null without a value estimate. */
export function parseRentcast(address: string, property: RentcastProperty | null, value: RentcastValue | null, rent: RentcastRent | null): HomeData | null {
  if (!value?.price) return null
  const tax = latest(property?.propertyTaxes)
  const assessment = latest(property?.taxAssessments)
  const taxAmount = tax?.total ?? null
  return {
    address: property?.formattedAddress ?? address,
    value: value.price,
    valueRange: value.priceRangeLow && value.priceRangeHigh ? { low: value.priceRangeLow, high: value.priceRangeHigh } : null,
    rentEstimate: rent?.rent ?? null,
    propertyTax: taxAmount && tax ? { amount: taxAmount, year: tax.year } : null,
    assessedValue: assessment?.value ?? null,
    effectiveTaxRate: taxAmount ? taxAmount / value.price : null,
    details: {
      propertyType: property?.propertyType ?? null,
      bedrooms: property?.bedrooms ?? null,
      bathrooms: property?.bathrooms ?? null,
      squareFeet: property?.squareFootage ?? null,
      yearBuilt: property?.yearBuilt ?? null,
      hoaMonthly: property?.hoa?.fee ?? null,
    },
    lastSale: property?.lastSalePrice && property.lastSaleDate ? { price: property.lastSalePrice, date: property.lastSaleDate.slice(0, 10) } : null,
    source: "rentcast",
  }
}

async function get<T>(path: string, apiKey: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { headers: { "X-Api-Key": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`RentCast ${res.status}`)
  return (await res.json()) as T
}

export function rentcastProvider(apiKey: string): HomeDataProvider {
  return {
    id: "rentcast",
    async lookup(address) {
      const q = encodeURIComponent(address)
      const [properties, value, rent] = await Promise.all([
        get<RentcastProperty[]>(`/properties?address=${q}`, apiKey),
        get<RentcastValue>(`/avm/value?address=${q}`, apiKey),
        get<RentcastRent>(`/avm/rent/long-term?address=${q}`, apiKey),
      ])
      return parseRentcast(address, properties?.[0] ?? null, value, rent)
    },
  }
}
