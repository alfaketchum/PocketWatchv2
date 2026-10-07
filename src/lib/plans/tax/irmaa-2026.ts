/**
 * Medicare IRMAA (income-related monthly adjustment amount), 2026 premium year (CMS): Part B and D premiums rise in
 * tiers once MAGI passes each line. Premiums are set on MAGI from two years earlier, so income at 63 already counts.
 * Lines are in 2026 dollars; the engine grows them with the plan's inflation. Only used as a cap on Roth conversions;
 * the surcharges themselves aren't charged yet.
 */
import type { FilingStatus } from "./federal-2026"

/** Where each surcharge tier starts: tier 0 (no surcharge) ends at the first line. */
export const IRMAA_TIERS: Record<FilingStatus, readonly number[]> = {
  single: [109_000, 137_000, 171_000, 205_000, 500_000],
  joint: [218_000, 274_000, 342_000, 410_000, 750_000],
}

export const MEDICARE_AGE = 65
export const IRMAA_LOOKBACK_YEARS = 2
/** Highest tier a cap can name (the one below the last line). */
export const IRMAA_MAX_CAP_TIER = IRMAA_TIERS.single.length - 1
