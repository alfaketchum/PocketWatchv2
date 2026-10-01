/**
 * Itemized deductions under the 2025 tax law (One Big Beautiful Bill Act): the SALT cap and the
 * mortgage-interest limit. Amounts are nominal dollars, not inflation-indexed beyond what the law sets.
 */

/** SALT cap by year: $40,000 in 2025, rising 1% a year through 2029, then back to $10,000. */
const SALT_CAP_2025 = 40_000
const SALT_PHASEOUT_START_2025 = 500_000
const SALT_STEP = 0.01
const SALT_LAST_HIGH_YEAR = 2029
export const SALT_FLOOR = 10_000
/** The cap shrinks by 30% of income over the phase-down line, never below the floor. */
const SALT_PHASEOUT_RATE = 0.3

/** Mortgage interest is deductible on up to this much acquisition debt (permanent from 2026). */
export const MORTGAGE_DEBT_LIMIT = 750_000

/** States that let homeowners deduct property tax on their state return: the most per year. */
export const STATE_PROPERTY_TAX_DEDUCTION: Record<string, number> = { NJ: 15_000 }

/** The SALT cap for `year` at this income (MAGI); before 2025 the old $10,000 cap. */
export function saltCap(year: number, magi: number): number {
  if (year < 2025 || year > SALT_LAST_HIGH_YEAR) return SALT_FLOOR
  const grow = Math.pow(1 + SALT_STEP, year - 2025)
  const cap = SALT_CAP_2025 * grow
  const over = Math.max(0, magi - SALT_PHASEOUT_START_2025 * grow)
  return Math.max(SALT_FLOOR, cap - SALT_PHASEOUT_RATE * over)
}

/** Itemizable amounts for one year, nominal. */
export interface Itemized {
  year: number
  /** Property tax on homes not rented out (any personal real estate counts toward SALT). */
  propertyTax: number
  /** Of that: on homes you live in (state property-tax deductions need a principal residence). */
  residenceTax: number
  /** Deductible mortgage interest (within the debt limit). */
  mortgageInterest: number
}
