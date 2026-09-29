export type FireMode = "basic" | "advanced"

export type SwrPreset = "4" | "3.5" | "3.25" | "cape" | "custom"

export type CryptoTreatment = "stocks" | "cash"

/** Where the simulated stock/bond/cash mix comes from. */
export type AllocationSource = "portfolio" | "manual"

/** Share of an account held in each asset class (sums to 1). */
export interface AccountMix {
  stocks: number
  bonds: number
  cash: number
}

export type FireTierKey = "lean" | "regular" | "chubby" | "fat"

export interface FireTier {
  key: FireTierKey
  label: string
  /** Annual retirement spend (today's dollars) that defines the tier's target. */
  annualSpend: number
}

/** Recurring real cash flow into the portfolio during retirement (Social Security, pension). */
export interface FireFlow {
  id: string
  label: string
  startAge: number
  /** Inclusive end age; null means for life. */
  endAge: number | null
  /** Positive = income into the portfolio, today's dollars per year. */
  annualAmount: number
}

export interface FireGlidepath {
  enabled: boolean
  startEquity: number
  endEquity: number
  years: number
}

/** Saved user inputs. `null` numeric fields follow the auto-filled baseline. */
export interface FireInputs {
  mode: FireMode
  currentAge: number
  /** Traditional retirement age used for Coast FIRE. */
  coastAge: number
  annualSpend: number | null
  annualContribution: number | null
  investableOverride: number | null
  includeCash: boolean
  includeCrypto: boolean
  swrPreset: SwrPreset
  customSwr: number
  realReturn: number
  equityShare: number
  allocationSource: AllocationSource
  accountMixes: Record<string, AccountMix>
  cryptoTreatment: CryptoTreatment
  glidepath: FireGlidepath
  horizonYears: number
  finalValueTarget: number
  capeA: number
  capeB: number
  partTimeIncome: number
  flows: FireFlow[]
  tiers: FireTier[]
}

/** Auto-filled values derived from the user's PocketWatch data. */
export interface FireBaseline {
  investable: { cash: number; savings: number; investments: number; crypto: number; debt: number }
  netWorth: number
  avgAnnualSpend: number | null
  typicalAnnualSpend: number | null
  annualIncome: number | null
  annualContribution: number | null
  savingsRate: number | null
  monthsOfData: number
}

/** Bundled historical dataset (see scripts/build-shiller-data.py). */
export interface ShillerDataset {
  source: string
  start: string
  dataThrough: string
  latestCape: number
  latestCapeMonth: string
  fields: string[]
  rows: [string, number, number, number | null][]
}

/** Parsed, typed-array form of the dataset for fast simulation. */
export interface MarketHistory {
  months: string[]
  equity: Float64Array
  bonds: Float64Array
  cape: (number | null)[]
  dataThrough: string
  latestCape: number
  latestCapeMonth: string
}

export interface EquityPlan {
  start: number
  end: number
  /** Months to move linearly from start to end; 0 = constant allocation. */
  glideMonths: number
  /** Constant cash share at 0% real return; bonds fill whatever stocks and cash leave. */
  cash?: number
}

/** Monthly flow as a fraction of the initial portfolio, by month offset from retirement. */
export interface MonthlyFlow {
  startMonth: number
  /** Exclusive. */
  endMonth: number
  amount: number
}

export interface SimOptions {
  equity: EquityPlan
  horizonMonths: number
  /** Real final value as a fraction of the initial portfolio. */
  finalValue: number
  feeAnnual: number
  flows: MonthlyFlow[]
}

export interface CohortSummary {
  startIndex: number
  month: string
  maxWr: number
  cape: number | null
  /** Annualized real return of the portfolio over its first 10 years. */
  first10YrReturn: number | null
}

export interface ProjectionPoint {
  age: number
  year: number
  value: number
}
