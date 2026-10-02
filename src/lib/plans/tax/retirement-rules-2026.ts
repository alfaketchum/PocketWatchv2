/**
 * Withdrawal rules for retirement accounts: required minimum distributions (SECURE 2.0, IRS Pub 590-B) and the 10%
 * additional tax on early withdrawals (IRC §72(t)).
 */
import type { PlanAccount, PlanDocument, PlanPerson } from "../plan-types"

/** Required withdrawals start at 73, or 75 for anyone born in 1960 or later (SECURE 2.0). */
const RMD_AGE = 73
const RMD_AGE_FROM_1960 = 75
const RMD_LATER_BIRTH_YEAR = 1960

/** IRS Pub 590-B (2025) Appendix B, Table III (Uniform Lifetime): age → applicable denominator; 120 and over use 2.0. */
const UNIFORM_LIFETIME: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4,
  82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
  92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0,
  102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
  112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}
const LAST_TABLE_AGE = 120

/** The 10% additional tax on traditional withdrawals before 59½. */
export const EARLY_WITHDRAWAL_PENALTY = 0.1
const PENALTY_FREE_AGE = 59
/** Born in the first half of the year: 59½ is reached in the year they turn 59. */
const HALF_YEAR_MONTH = 6

export function rmdStartAge(birthYear: number): number {
  return birthYear >= RMD_LATER_BIRTH_YEAR ? RMD_AGE_FROM_1960 : RMD_AGE
}

/** Divisor for the year's required withdrawal at `age` (age reached by year end). */
export function rmdDivisor(age: number): number {
  return UNIFORM_LIFETIME[Math.min(Math.max(age, 72), LAST_TABLE_AGE)]
}

/** Age reached by the end of `year`. */
export const ageInYear = (person: PlanPerson, year: number) => year - person.birthYear

/** Whether `person` reaches 59½ by the end of `year` (the whole plan year then counts as penalty-free). */
export function penaltyFree(person: PlanPerson, year: number): boolean {
  const age = ageInYear(person, year)
  return age > PENALTY_FREE_AGE || (age === PENALTY_FREE_AGE && person.birthMonth <= HALF_YEAR_MONTH)
}

/** Whose account this is: its owner, or the first person when it has none. */
export function accountOwner(account: PlanAccount, doc: PlanDocument): PlanPerson | undefined {
  return doc.people.find((p) => p.id === account.owner) ?? doc.people[0]
}

/** Traditional accounts the owner contributed to (inherited ones follow the 10-year rule instead). */
export const ownTraditional = (account: PlanAccount) => account.taxTreatment === "traditional" && !account.drainByYear
