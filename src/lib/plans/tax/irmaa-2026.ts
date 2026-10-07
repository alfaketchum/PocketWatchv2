/**
 * Medicare IRMAA (income-related monthly adjustment amount), 2026 premium year (CMS fact sheet; SSA POMS
 * HI 01101020; 42 USC 1395r(i)): from 65, Part B and D premiums rise in tiers once MAGI passes each line. Premiums are
 * set on MAGI from two years earlier, so income at 63 already counts. Lines are in 2026 dollars and grow with the
 * plan's inflation, except the top one ($500,000 / $750,000), which the law only indexes from 2028. The engine charges
 * each person on Medicare the surcharge for their tier; Roth conversion rules can also stay under a tier.
 */
import type { FilingStatus } from "./federal-2026"

/** Where each surcharge tier starts: tier 0 (no surcharge) ends at the first line. */
export const IRMAA_TIERS: Record<FilingStatus, readonly number[]> = {
  single: [109_000, 137_000, 171_000, 205_000, 500_000],
  joint: [218_000, 274_000, 342_000, 410_000, 750_000],
}

/** Extra per person per month at tiers 1–5: Part B ($81.20 … $487.00) plus Part D ($14.50 … $91.00), 2026. */
export const IRMAA_MONTHLY_SURCHARGE: readonly number[] = [95.7, 240.4, 385.0, 529.6, 578.0]

export const MEDICARE_AGE = 65
export const IRMAA_LOOKBACK_YEARS = 2
/** Highest tier a cap can name (the one below the last line). */
export const IRMAA_MAX_CAP_TIER = IRMAA_TIERS.single.length - 1
/** The top line ($500,000 / $750,000) is fixed until then, and indexed from it. */
export const TOP_TIER_INDEXED_FROM = 2028
const BASE_YEAR = 2026

/**
 * The line where tier `tier` + 1 starts, in `year`'s dollars. `index` is the year's threshold index (2026 = 1); the
 * top line only grows from 2028, by the inflation since then (read off `index` at its average yearly rate).
 */
export function irmaaLine(status: FilingStatus, tier: number, index: number, year: number): number {
  const lines = IRMAA_TIERS[status]
  const line = lines[tier]
  if (line === undefined) return Infinity
  if (tier < lines.length - 1) return line * index
  if (year <= TOP_TIER_INDEXED_FROM || year <= BASE_YEAR) return line
  const yearly = Math.pow(index, 1 / (year - BASE_YEAR))
  return line * Math.pow(yearly, year - TOP_TIER_INDEXED_FROM)
}

/** The surcharge tier (0 = none … 5) for MAGI in `year`. */
export function irmaaTierFor(magi: number, status: FilingStatus, index: number, year: number): number {
  let tier = 0
  while (tier < IRMAA_TIERS[status].length && magi > irmaaLine(status, tier, index, year)) tier++
  return tier
}
