/** What a home-data provider knows about a home, normalized across providers. Money in dollars. */
export interface HomeData {
  address: string
  /** Estimated market value today. */
  value: number
  valueRange: { low: number; high: number } | null
  /** Estimated long-term rent per month. */
  rentEstimate: number | null
  /** The latest yearly property tax bill, and its year. */
  propertyTax: { amount: number; year: number } | null
  assessedValue: number | null
  /** Property tax bill ÷ value: the home's effective rate. */
  effectiveTaxRate: number | null
  details: {
    propertyType: string | null
    bedrooms: number | null
    bathrooms: number | null
    squareFeet: number | null
    yearBuilt: number | null
    hoaMonthly: number | null
  }
  lastSale: { price: number; date: string } | null
  /** Provider id: "rentcast" or "mock". */
  source: string
}

export interface HomeDataProvider {
  id: string
  lookup(address: string): Promise<HomeData | null>
}
