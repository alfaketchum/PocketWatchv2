/**
 * Sample home data for trying the flow without a provider key: deterministic per address, shaped like a
 * real lookup (value, tax bill at the state's effective rate, rent, facts, last sale).
 */

import { propertyTaxRate } from "@/lib/plans/tax/property-tax-rates"
import type { HomeData, HomeDataProvider } from "./types"

const MIN_VALUE = 250_000
const VALUE_SPREAD = 1_750_000
const RENT_PER_VALUE = 0.0045
const TAX_YEAR = 2025

/** A stable number in [0, 1) from text. */
function seeded(text: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10_000) / 10_000
}

/** A two-letter state after the last comma, e.g. "… Jersey City, NJ 07302". */
export function stateFromAddress(address: string): string | null {
  const match = /,\s*([A-Z]{2})\b(?:\s+\d{5})?\s*$/.exec(address.trim())
  return match ? match[1] : null
}

export function mockHomeData(address: string): HomeData {
  const key = address.trim().toLowerCase()
  const value = Math.round((MIN_VALUE + seeded(key, 1) * VALUE_SPREAD) / 1000) * 1000
  const rate = propertyTaxRate(stateFromAddress(address))
  const tax = Math.round(value * rate * (0.85 + seeded(key, 2) * 0.3))
  const bedrooms = 2 + Math.floor(seeded(key, 3) * 4)
  const soldYears = 3 + Math.floor(seeded(key, 4) * 15)
  return {
    address: address.trim(),
    value,
    valueRange: { low: Math.round(value * 0.92), high: Math.round(value * 1.08) },
    rentEstimate: Math.round((value * RENT_PER_VALUE) / 10) * 10,
    propertyTax: { amount: tax, year: TAX_YEAR },
    assessedValue: Math.round(value * 0.8),
    effectiveTaxRate: tax / value,
    details: {
      propertyType: bedrooms > 3 ? "Single Family" : "Condo",
      bedrooms,
      bathrooms: Math.max(1, bedrooms - 1),
      squareFeet: 700 + bedrooms * 450,
      yearBuilt: 1950 + Math.floor(seeded(key, 5) * 70),
      hoaMonthly: bedrooms > 3 ? null : 450,
    },
    lastSale: { price: Math.round(value * Math.pow(1 / 1.04, soldYears) / 1000) * 1000, date: `${new Date().getFullYear() - soldYears}-06-15` },
    source: "mock",
  }
}

export const mockProvider: HomeDataProvider = { id: "mock", lookup: async (address) => mockHomeData(address) }
