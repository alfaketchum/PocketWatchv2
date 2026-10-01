/**
 * Vehicle depreciation by age instead of one flat rate. A car loses about 20% of its value in its first year
 * (LendingTree 2025), about 45.6% by year 5 (iSeeCars, 5-year average) and about 72% by year 10 (ForCar
 * Research), then keeps sliding. Rates are nominal at the plan's inflation (like `appreciation`).
 */

/** Yearly value change by the car's age: [first age it applies to, rate]. */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -0.2], // year 1
  [1, -0.0917], // years 2–5: 0.80 → 0.544
  [5, -0.1257], // years 6–10: 0.544 → 0.28
  [10, -0.1], // after that
]
/** Never worth less than this share of its new price (scrap and private-sale floor). */
const FLOOR = 0.05

function rateAtAge(age: number): number {
  let rate = STEPS[0][1]
  for (const [from, r] of STEPS) if (age >= from) rate = r
  return rate
}

/** Value at `age` (years, whole) as a share of the new price. */
export function vehicleValueShare(age: number): number {
  let share = 1
  for (let a = 0; a < Math.max(0, Math.floor(age)); a++) share = Math.max(FLOOR, share * (1 + rateAtAge(a)))
  return share
}

/** How a car's value changes over `years` owned when it was `ageAtStart` years old: value then ÷ value now. */
export function vehicleValueRatio(ageAtStart: number, years: number): number {
  return vehicleValueShare(ageAtStart + years) / vehicleValueShare(ageAtStart)
}

export type VehicleCondition = "new" | "preOwned" | "used"

/**
 * Buying options with typical prices (today's dollars): a new vehicle at the average transaction price
 * (Kelley Blue Book, Dec 2025: $50,326); pre-owned (about 3 years old) at that price down the curve; used at
 * the average used listing price (Cox Automotive, Dec 2025: $26,043), about 6 years old on the curve. Loan
 * rates: Experian State of the Automotive Finance Market, Q2 2026 averages (new 6.35%, used 11.19%).
 */
export const VEHICLE_CONDITIONS: Record<VehicleCondition, { label: string; age: number; price: number; loanRate: number; hint: string }> = {
  new: { label: "Brand new", age: 0, price: 50_300, loanRate: 0.0635, hint: "Average new-vehicle price (Kelley Blue Book, Dec 2025). Loses about 20% the first year." },
  preOwned: { label: "Pre-owned", age: 3, price: 33_000, loanRate: 0.1119, hint: "About 3 years old (certified pre-owned): the steepest drop is already behind it. Used-car loan rates." },
  used: { label: "Used", age: 6, price: 26_000, loanRate: 0.1119, hint: "Average used listing (Cox Automotive, Dec 2025), about 6 years old: cheapest up front, more repairs." },
}

/** The condition a vehicle's age matches, for showing the choice. */
export function conditionOf(age: number | undefined): VehicleCondition | null {
  if (age === undefined) return null
  if (age <= 0) return "new"
  return age <= 4 ? "preOwned" : "used"
}
