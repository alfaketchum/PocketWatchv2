import type { FireInputs, FireTier, SwrPreset } from "./fire-types"

export const DEFAULT_TIERS: FireTier[] = [
  { key: "lean", label: "Lean FIRE", annualSpend: 40_000 },
  { key: "regular", label: "Regular FIRE", annualSpend: 80_000 },
  { key: "chubby", label: "Chubby FIRE", annualSpend: 150_000 },
  { key: "fat", label: "Fat FIRE", annualSpend: 250_000 },
]

/** Annual fund-expense drag used by ERN's SWR series. */
export const FEE_DRAG_ANNUAL = 0.0005

/** ERN's default CAPE-based rule: WR = a + b / CAPE. */
export const CAPE_RULE_DEFAULT_A = 0.0175
export const CAPE_RULE_DEFAULT_B = 0.5

export const SWR_HORIZONS = [30, 40, 50, 60] as const
export const FINAL_VALUE_TARGETS = [0, 0.5, 1] as const
export const EQUITY_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const

/** Notable bad-sequence retirement cohorts highlighted in charts. */
export const NOTABLE_COHORTS = ["1929-09", "1937-03", "1965-12", "1973-01", "2000-01", "2007-10"] as const

export const SWR_PRESET_RATES: Record<Exclude<SwrPreset, "cape" | "custom">, number> = {
  "4": 0.04,
  "3.5": 0.035,
  "3.25": 0.0325,
}

export const BASIC_SWR_PRESETS: { value: SwrPreset; label: string; hint: string }[] = [
  { value: "4", label: "Standard (4%)", hint: "The classic 4% rule — built for ~30-year retirements" },
  { value: "3.5", label: "Cautious (3.5%)", hint: "Big ERN's suggestion for 50–60 year early retirements" },
  { value: "3.25", label: "Very safe (3.25%)", hint: "Survived every historical retirement since 1871, even at high valuations" },
]

export const MAX_PROJECTION_YEARS = 70

export const DEFAULT_FIRE_INPUTS: FireInputs = {
  mode: "basic",
  currentAge: 35,
  coastAge: 65,
  annualSpend: null,
  annualContribution: null,
  investableOverride: null,
  includeCash: false,
  includeCrypto: true,
  swrPreset: "3.5",
  customSwr: 0.035,
  realReturn: 0.05,
  equityShare: 0.8,
  allocationSource: "portfolio",
  accountMixes: {},
  cryptoTreatment: "stocks",
  glidepath: { enabled: false, startEquity: 0.6, endEquity: 1, years: 10 },
  horizonYears: 50,
  finalValueTarget: 0,
  capeA: CAPE_RULE_DEFAULT_A,
  capeB: CAPE_RULE_DEFAULT_B,
  partTimeIncome: 20_000,
  flows: [],
  tiers: DEFAULT_TIERS,
}
