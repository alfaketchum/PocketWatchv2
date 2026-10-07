/**
 * How much more ordinary income (a Roth conversion) fits under a line: the top of a bracket, a taxable-income
 * target, an IRMAA tier or the end of the 0% long-term gains bracket. Taxable Social Security and the deduction
 * phase-outs bend the curve, so the room is found by bisection on the exact rules.
 */
import { FEDERAL_LTCG, FEDERAL_ORDINARY, type FilingStatus } from "./federal-2026"
import { IRMAA_TIERS } from "./irmaa-2026"
import { federalDeduction, seniorDeduction, stateTax, withTaxableSocialSecurity, type TaxBase, type TaxSituation } from "./tax-calc"

const BISECT_STEPS = 40
const TOLERANCE = 1

const addOrdinary = (b: TaxBase, x: number): TaxBase => ({ ...b, ordinary: b.ordinary + x })

function deduction(b: TaxBase, s: TaxSituation): number {
  return federalDeduction(b, s, stateTax(b, s)).amount + seniorDeduction(b, s)
}

/** Federal taxable income: ordinary (with short-term gains), and total (with long-term gains). */
export function taxableIncome(base: TaxBase, s: TaxSituation): { ordinary: number; total: number } {
  const b = withTaxableSocialSecurity(base, s)
  const d = deduction(b, s)
  const ordinary = b.ordinary + b.shortGains
  return { ordinary: Math.max(0, ordinary - d), total: Math.max(0, ordinary + b.longGains - d) }
}

/** Modified AGI as Medicare counts it (tax-exempt interest isn't modeled). */
export function magi(base: TaxBase, s: TaxSituation): number {
  const b = withTaxableSocialSecurity(base, s)
  return b.ordinary + b.shortGains + b.longGains
}

/** Top of the federal bracket taxed at `rate` (this year's dollars); null for the top bracket. */
export function bracketCeiling(status: FilingStatus, rate: number, index: number): number | null {
  const brackets = FEDERAL_ORDINARY[status]
  const i = brackets.findIndex(([, r]) => Math.abs(r - rate) < 1e-9)
  return i >= 0 && i + 1 < brackets.length ? brackets[i + 1][0] * index : null
}

/** The largest x in [0, upper] with fits(x), for a `fits` that only turns false as x grows. */
export function largestAddition(upper: number, fits: (x: number) => boolean): number {
  if (upper <= 0 || !fits(0)) return 0
  if (fits(upper)) return upper
  let lo = 0
  let hi = upper
  for (let i = 0; i < BISECT_STEPS && hi - lo > TOLERANCE; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}

/** Room before taxable ordinary income passes the top of the `rate` bracket (unlimited for the top bracket). */
export function roomToBracket(b: TaxBase, s: TaxSituation, upper: number, rate: number): number {
  const ceiling = bracketCeiling(s.status, rate, s.index)
  if (ceiling === null) return upper
  return largestAddition(upper, (x) => taxableIncome(addOrdinary(b, x), s).ordinary <= ceiling)
}

/** Room before total federal taxable income passes `target` (this year's dollars). */
export function roomToTaxable(b: TaxBase, s: TaxSituation, upper: number, target: number): number {
  return largestAddition(upper, (x) => taxableIncome(addOrdinary(b, x), s).total <= target)
}

/** Room before MAGI reaches the line where IRMAA tier `tier` + 1 starts (lines are cliffs). */
export function roomUnderIrmaa(b: TaxBase, s: TaxSituation, upper: number, tier: number): number {
  const line = IRMAA_TIERS[s.status][tier]
  if (line === undefined) return upper
  const limit = line * s.index - TOLERANCE
  return largestAddition(upper, (x) => magi(addOrdinary(b, x), s) <= limit)
}

/** Room before ordinary income starts pushing long-term gains out of the 0% bracket. */
export function roomInLtcgZero(b: TaxBase, s: TaxSituation, upper: number): number {
  if (b.longGains <= 0) return upper
  const line = FEDERAL_LTCG[s.status][1][0] * s.index
  const atZero = (x: number) => Math.min(b.longGains, Math.max(0, line - taxableIncome(addOrdinary(b, x), s).ordinary))
  const now = atZero(0)
  return largestAddition(upper, (x) => atZero(x) >= now - TOLERANCE)
}
