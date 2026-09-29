import { MAX_PROJECTION_YEARS } from "./fire-constants"
import type { FireTier, FireTierKey, ProjectionPoint } from "./fire-types"

/** Nest egg needed to fund `annualSpend` at withdrawal rate `swr`. */
export function fireNumber(annualSpend: number, swr: number): number {
  if (swr <= 0) return Infinity
  return Math.max(0, annualSpend) / swr
}

/**
 * Years until `current` grows to `target` with real return `r` and a constant
 * annual contribution added at year end. Returns 0 if already there, null if never.
 */
export function yearsToTarget(current: number, contribution: number, r: number, target: number): number | null {
  if (current >= target) return 0
  if (Math.abs(r) < 1e-9) {
    return contribution > 0 ? (target - current) / contribution : null
  }
  const numerator = target * r + contribution
  const denominator = current * r + contribution
  if (denominator <= 0 || numerator / denominator <= 0) return null
  const years = Math.log(numerator / denominator) / Math.log(1 + r)
  return Number.isFinite(years) && years >= 0 ? years : null
}

/** A one-time inflow `yearsFromNow` years out, credited at the end of that projection year. */
export interface Windfall {
  yearsFromNow: number
  amount: number
}

function windfallsInYear(windfalls: Windfall[], year: number): number {
  return windfalls.reduce((s, w) => (w.yearsFromNow > year - 1 && w.yearsFromNow <= year ? s + w.amount : s), 0)
}

/** Year-by-year projected portfolio value (today's dollars), including one-time windfalls. */
export function projectPath(
  current: number,
  contribution: number,
  r: number,
  currentAge: number,
  years: number,
  startYear: number,
  windfalls: Windfall[] = [],
): ProjectionPoint[] {
  const span = Math.min(Math.max(1, Math.ceil(years)), MAX_PROJECTION_YEARS)
  const points: ProjectionPoint[] = [{ age: currentAge, year: startYear, value: current }]
  let value = current
  for (let i = 1; i <= span; i++) {
    value = value * (1 + r) + contribution + windfallsInYear(windfalls, i)
    points.push({ age: currentAge + i, year: startYear + i, value })
  }
  return points
}

/**
 * `yearsToTarget` with one-time windfalls. Steps a year at a time and uses the closed form
 * within a year, so with no windfalls it matches `yearsToTarget` exactly.
 */
export function yearsToTargetWithWindfalls(
  current: number,
  contribution: number,
  r: number,
  target: number,
  windfalls: Windfall[],
): number | null {
  const upcoming = windfalls.filter((w) => w.yearsFromNow > 0 && w.amount > 0)
  if (upcoming.length === 0) return yearsToTarget(current, contribution, r, target)
  let value = current
  for (let n = 0; n < MAX_PROJECTION_YEARS; n++) {
    const within = yearsToTarget(value, contribution, r, target)
    if (within !== null && within <= 1) return n + within
    value = value * (1 + r) + contribution + windfallsInYear(upcoming, n + 1)
    if (value >= target) return n + 1
  }
  return null
}

/** Amount needed today so that growth alone reaches `target` by `years` from now. */
export function coastNumber(target: number, years: number, r: number): number {
  if (years <= 0) return target
  return target / Math.pow(1 + r, years)
}

/**
 * Years of continued contributions before the portfolio can "coast" to `target`
 * by `yearsToCoastAge` from now. Null if it never gets there before that age.
 */
export function yearsToCoast(
  current: number,
  contribution: number,
  r: number,
  target: number,
  yearsToCoastAge: number,
): number | null {
  let value = current
  for (let n = 0; n <= Math.max(0, Math.floor(yearsToCoastAge)); n++) {
    if (value * Math.pow(1 + r, yearsToCoastAge - n) >= target) return n
    value = value * (1 + r) + contribution
  }
  return null
}

/** Part-time income per year still needed if you stopped full-time work today. */
export function baristaGap(annualSpend: number, portfolio: number, swr: number): number {
  return Math.max(0, annualSpend - portfolio * swr)
}

/** Nest egg needed when part-time work covers `partTimeIncome` of spending. */
export function baristaNumber(annualSpend: number, partTimeIncome: number, swr: number): number {
  return fireNumber(Math.max(0, annualSpend - partTimeIncome), swr)
}

/** The tier whose spend level covers `annualSpend` (the largest tier if above all). */
export function tierForSpend(tiers: FireTier[], annualSpend: number): FireTierKey | null {
  if (tiers.length === 0) return null
  const sorted = [...tiers].sort((a, b) => a.annualSpend - b.annualSpend)
  const match = sorted.find((t) => annualSpend <= t.annualSpend)
  return (match ?? sorted[sorted.length - 1]).key
}
