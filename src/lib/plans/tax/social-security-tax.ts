/**
 * How much Social Security is taxable (IRC §86): up to 50%, then 85%, of benefits as "provisional income"
 * (other income plus half of benefits) passes two thresholds that have never been indexed for inflation.
 * States: only these eight tax benefits in 2026 (West Virginia finished phasing its tax out); each taxes the
 * federally taxable amount here, though several exempt lower incomes or older filers (not modeled).
 */
import type { FilingStatus } from "./federal-2026"

export const SS_THRESHOLDS: Record<FilingStatus, readonly [number, number]> = { single: [25_000, 34_000], joint: [32_000, 44_000] }
const FIRST_SHARE = 0.5
const MAX_SHARE = 0.85

export const SS_TAXING_STATES = new Set(["CO", "CT", "MN", "MT", "NM", "RI", "UT", "VT"])

/** Taxable part of `benefits` given the year's other income (wages, pensions, withdrawals, gains). */
export function taxableSocialSecurity(benefits: number, otherIncome: number, status: FilingStatus): number {
  if (benefits <= 0) return 0
  const [base, upper] = SS_THRESHOLDS[status]
  const provisional = otherIncome + FIRST_SHARE * benefits
  if (provisional <= base) return 0
  const firstTier = Math.min(FIRST_SHARE * benefits, FIRST_SHARE * (Math.min(provisional, upper) - base))
  if (provisional <= upper) return firstTier
  return Math.min(MAX_SHARE * benefits, MAX_SHARE * (provisional - upper) + Math.min(FIRST_SHARE * benefits, FIRST_SHARE * (upper - base)))
}
