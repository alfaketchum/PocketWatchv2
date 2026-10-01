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

const SPOUSAL_SHARE = 0.5
const SPOUSAL_EARLY_FIRST_RATE = 25 / 36 / 100
/** Earliest age for a survivor benefit, and its size then (71.5% of the deceased's benefit). */
export const SURVIVOR_EARLIEST_AGE = 60
const SURVIVOR_AT_EARLIEST = 0.715
/** The widow(er)'s limit: when the deceased claimed early, the survivor still gets at least this share of their PIA. */
const WIDOW_LIMIT = 0.825

/**
 * Spousal benefit factor at `age`: up to 50% of the partner's PIA at full retirement age, reduced 25/36 of 1%
 * a month for the first 36 months early and 5/12 of 1% beyond; no credits for waiting past it.
 */
export function spousalFactor(birthYear: number, age: number): number {
  const early = Math.max(0, Math.round((fullRetirementAge(birthYear) - age) * MONTHS))
  return 1 - Math.min(early, EARLY_FIRST_MONTHS) * SPOUSAL_EARLY_FIRST_RATE - Math.max(0, early - EARLY_FIRST_MONTHS) * EARLY_LATER_RATE
}

/** Yearly spousal top-up: half the partner's PIA beyond your own PIA, at your spousal factor. */
export function spousalTopUp(ownPia: number, partnerPia: number, birthYear: number, age: number): number {
  return Math.max(0, SPOUSAL_SHARE * partnerPia - ownPia) * MONTHS * spousalFactor(birthYear, age)
}

/**
 * Yearly survivor benefit: what the deceased received (with their delay credits), at least 82.5% of their PIA
 * when they claimed early, reduced when the survivor takes it before their own full retirement age (71.5% at 60).
 */
export function survivorBenefit(deceased: { pia: number; claimAge: number; birthYear: number }, survivorBirthYear: number, survivorAge: number): number {
  const theirs = deceased.pia * claimFactor(deceased.birthYear, deceased.claimAge)
  const base = Math.max(theirs, Math.min(deceased.pia, WIDOW_LIMIT * deceased.pia))
  const fra = fullRetirementAge(survivorBirthYear)
  const age = Math.max(SURVIVOR_EARLIEST_AGE, survivorAge)
  const reduction = age >= fra ? 0 : ((fra - age) / (fra - SURVIVOR_EARLIEST_AGE)) * (1 - SURVIVOR_AT_EARLIEST)
  return base * MONTHS * (1 - reduction)
}
