/**
 * Social Security claiming age (SSA rules): the benefit at full retirement age (FRA) is reduced for each
 * month claimed early (5/9 of 1% for the first 36 months, 5/12 of 1% after) and raised 2/3 of 1% for each
 * month delayed, up to age 70. Amounts are in today's dollars; benefits then rise with inflation (COLA).
 */

export const SS_EARLIEST_AGE = 62
export const SS_LATEST_AGE = 70
const MONTHS = 12
const EARLY_FIRST_MONTHS = 36
const EARLY_FIRST_RATE = 5 / 9 / 100
const EARLY_LATER_RATE = 5 / 12 / 100
const DELAY_RATE = 2 / 3 / 100

/** Full retirement age in years: 66 for 1943–54 births, rising 2 months a year to 67 for 1960 and later. */
export function fullRetirementAge(birthYear: number): number {
  if (birthYear <= 1954) return 66
  if (birthYear >= 1960) return 67
  return 66 + ((birthYear - 1954) * 2) / MONTHS
}

/** Share of the FRA benefit paid when claiming at `claimAge` (e.g. 0.70 at 62, 1.24 at 70 for FRA 67). */
export function claimFactor(birthYear: number, claimAge: number): number {
  const age = Math.min(SS_LATEST_AGE, Math.max(SS_EARLIEST_AGE, claimAge))
  const months = Math.round((age - fullRetirementAge(birthYear)) * MONTHS)
  if (months >= 0) return 1 + months * DELAY_RATE
  const early = -months
  return 1 - Math.min(early, EARLY_FIRST_MONTHS) * EARLY_FIRST_RATE - Math.max(0, early - EARLY_FIRST_MONTHS) * EARLY_LATER_RATE
}

/** Yearly benefit when claiming at `claimAge`, from the monthly benefit at full retirement age. */
export function yearlyBenefit(monthlyAtFra: number, birthYear: number, claimAge: number): number {
  return monthlyAtFra * MONTHS * claimFactor(birthYear, claimAge)
}
