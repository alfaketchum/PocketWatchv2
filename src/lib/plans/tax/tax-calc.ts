import {
  AMT_EXEMPTION,
  AMT_PHASEOUT_RATE,
  AMT_PHASEOUT_START,
  AMT_RATES,
  FEDERAL_AGED_ADDITION,
  FEDERAL_LTCG,
  FEDERAL_ORDINARY,
  FEDERAL_STANDARD_DEDUCTION,
  NIIT_RATE,
  NIIT_THRESHOLD,
  SENIOR_DEDUCTION,
  TAX_BASE_YEAR,
  type Brackets,
  type FilingStatus,
} from "./federal-2026"
import { STATE_GAINS } from "./state-gains-2026"
import { STATE_TAX, type StateTax } from "./state-2026"
import { priceIndex, rateAt, type Inflation } from "../plan-inflation"
import { interestWithinLimit, MORTGAGE_DEBT_LIMIT, saltCap, type Itemized } from "./itemized-2026"
import { STATE_HOMEOWNER, type StateHomeownerRules } from "./state-homeowner-2026"
import { SS_TAXING_STATES, taxableSocialSecurity } from "./social-security-tax"

/** Tax on `income` over progressive `brackets` whose thresholds are scaled by `index`. */
export function bracketTax(income: number, brackets: Brackets, index = 1): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const lower = brackets[i][0] * index
    const upper = i + 1 < brackets.length ? brackets[i + 1][0] * index : Infinity
    if (income <= lower) break
    tax += (Math.min(income, upper) - lower) * brackets[i][1]
  }
  return tax
}

/** Rate on the next dollar of `income`. */
export function marginalRate(income: number, brackets: Brackets, index = 1): number {
  let rate = brackets[0]?.[1] ?? 0
  for (const [threshold, r] of brackets) if (income >= threshold * index) rate = r
  return rate
}

/**
 * Inflation index for tax thresholds in `year` (2026 dollars → that year's dollars). A yearly path starts at
 * `startYear` (the plan's first year); years between 2026 and it use the path's first rate.
 */
export function thresholdIndex(year: number, inflation: Inflation, startYear = TAX_BASE_YEAR): number {
  const lead = Math.pow(1 + rateAt(inflation, 0), startYear - TAX_BASE_YEAR)
  return lead * priceIndex(inflation, year - startYear)
}

export interface TaxSituation {
  status: FilingStatus
  /** Two-letter state code, or null for no state income tax. */
  state: string | null
  /** Threshold index for the year (see thresholdIndex). */
  index: number
  /** Property tax and mortgage interest this year; without it only the standard deduction applies. */
  itemized?: Itemized
  /** Minimum tax credit carried in from earlier years' AMT on ISOs; it comes off regular tax above the AMT. */
  amtCredit?: number
  /** Filers 65 or older by the end of the year (extra standard deduction and the senior deduction). */
  seniors?: number
  /** The tax year (the senior deduction only exists 2025–2028). */
  year?: number
}

/** A year's taxable income by kind. */
export interface TaxBase {
  /** Wages, pensions, traditional withdrawals, taxable Social Security… */
  ordinary: number
  /** Gains on things held a year or less: taxed as ordinary income. */
  shortGains: number
  /** Gains on things held over a year (after the home-sale exclusion). */
  longGains: number
  /** The part of `longGains` from real estate (some state rules treat it differently). */
  realEstateGains: number
  /** Social Security benefits received (gross); the taxable part joins `ordinary` (see withTaxableSocialSecurity). */
  socialSecurity: number
  /** Income only the AMT counts: the gain on ISOs exercised and kept. */
  amtPreference: number
}

export function taxBase(part: Partial<TaxBase>): TaxBase {
  return { ordinary: 0, shortGains: 0, longGains: 0, realEstateGains: 0, socialSecurity: 0, amtPreference: 0, ...part }
}

/** The base with Social Security's taxable part moved into ordinary income (safe to apply twice). */
export function withTaxableSocialSecurity(b: TaxBase, s: TaxSituation): TaxBase {
  if (b.socialSecurity <= 0) return b
  const taxable = taxableSocialSecurity(b.socialSecurity, b.ordinary + b.shortGains + b.longGains, s.status)
  return { ...b, ordinary: b.ordinary + taxable, socialSecurity: 0 }
}

/** What the state taxes: the federally taxable Social Security in the states that tax it, none elsewhere. */
function stateBase(b: TaxBase, s: TaxSituation): TaxBase {
  return s.state && SS_TAXING_STATES.has(s.state) ? withTaxableSocialSecurity(b, s) : { ...b, socialSecurity: 0 }
}

/** 3.8% on investment income (all gains) above the MAGI line. */
function netInvestmentIncomeTax(b: TaxBase, s: TaxSituation): number {
  const investment = b.shortGains + b.longGains
  const over = b.ordinary + investment - NIIT_THRESHOLD[s.status]
  return NIIT_RATE * Math.max(0, Math.min(investment, over))
}

/**
 * The federal deduction: the larger of the standard deduction and itemizing SALT (state income tax plus
 * property tax, under the year's cap) and mortgage interest.
 */
export function federalDeduction(base: TaxBase, s: TaxSituation, stateIncomeTax: number): { amount: number; itemized: boolean } {
  const b = withTaxableSocialSecurity(base, s)
  const standard = (FEDERAL_STANDARD_DEDUCTION[s.status] + (s.seniors ?? 0) * FEDERAL_AGED_ADDITION[s.status]) * s.index
  const it = s.itemized
  if (!it) return { amount: standard, itemized: false }
  const itemized = federalItemized(b, it, stateIncomeTax)
  return itemized > standard ? { amount: itemized, itemized: true } : { amount: standard, itemized: false }
}

/** The 2025–2028 senior deduction: $6,000 per filer 65+, each less 6% of MAGI over the line; on top of standard or itemized. */
export function seniorDeduction(base: TaxBase, s: TaxSituation): number {
  const { amount, firstYear, lastYear, phaseOutRate, threshold } = SENIOR_DEDUCTION
  if (!s.seniors || s.year === undefined || s.year < firstYear || s.year > lastYear) return 0
  const b = withTaxableSocialSecurity(base, s)
  const magi = b.ordinary + b.shortGains + b.longGains
  return s.seniors * Math.max(0, amount - phaseOutRate * Math.max(0, magi - threshold[s.status]))
}

/** Federal itemized deductions: SALT under the year's cap plus mortgage interest on up to $750,000. */
function federalItemized(b: TaxBase, it: Itemized, stateIncomeTax: number): number {
  const magi = b.ordinary + b.shortGains + b.longGains
  return Math.min(saltCap(it.year, magi), stateIncomeTax + it.propertyTax) + interestWithinLimit(it, MORTGAGE_DEBT_LIMIT)
}

/** Tax on `ordinary` income through `brackets`, with long-term `gains` stacked on top at 0 / 15 / 20%. */
function withGainsStacked(ordinary: number, gains: number, brackets: Brackets, s: TaxSituation): number {
  const ltcg = FEDERAL_LTCG[s.status]
  return bracketTax(ordinary, brackets, s.index) + bracketTax(ordinary + gains, ltcg, s.index) - bracketTax(ordinary, ltcg, s.index)
}

/** Regular federal income tax (no NIIT): ordinary income and short-term gains through the brackets, gains on top. */
function regularFederalTax(b: TaxBase, s: TaxSituation, stateIncomeTax: number): number {
  const ordinary = b.ordinary + b.shortGains
  const deduction = federalDeduction(b, s, stateIncomeTax).amount + seniorDeduction(b, s)
  // Unused deduction shelters gains too.
  const gainsTaxable = Math.max(0, b.longGains - Math.max(0, deduction - ordinary))
  return withGainsStacked(Math.max(0, ordinary - deduction), gainsTaxable, FEDERAL_ORDINARY[s.status], s)
}

/**
 * Tentative minimum tax: AMT income is all income plus ISO gains, less only mortgage interest (no standard
 * deduction, no state and local taxes), less the exemption, which phases out at 50%; 26% / 28%, gains at their
 * own rates.
 */
function tentativeMinimumTax(b: TaxBase, s: TaxSituation): number {
  const interest = s.itemized ? interestWithinLimit(s.itemized, MORTGAGE_DEBT_LIMIT) : 0
  const amti = Math.max(0, b.ordinary + b.shortGains + b.longGains + b.amtPreference - interest)
  const phaseOut = AMT_PHASEOUT_RATE * Math.max(0, amti - AMT_PHASEOUT_START[s.status] * s.index)
  const taxable = Math.max(0, amti - Math.max(0, AMT_EXEMPTION[s.status] * s.index - phaseOut))
  const gains = Math.min(taxable, b.longGains)
  return Math.min(withGainsStacked(taxable - gains, gains, AMT_RATES, s), bracketTax(taxable, AMT_RATES, s.index))
}

export interface MinimumTax {
  /** AMT owed on top of regular tax. */
  amt: number
  /** Of `amt`: what ISO gains caused, which comes back as a credit in later years. */
  creditEarned: number
  /** Credit from earlier years used this year (regular tax above the tentative minimum tax). */
  creditUsed: number
}

/** The year's AMT, the part that becomes a credit, and the credit used. */
export function minimumTax(base: TaxBase, s: TaxSituation, stateIncomeTax: number): MinimumTax {
  const b = withTaxableSocialSecurity(base, s)
  const regular = regularFederalTax(b, s, stateIncomeTax)
  const tentative = tentativeMinimumTax(b, s)
  const amt = Math.max(0, tentative - regular)
  const withoutIso = b.amtPreference > 0 ? Math.max(0, tentativeMinimumTax({ ...b, amtPreference: 0 }, s) - regular) : amt
  return { amt, creditEarned: amt - withoutIso, creditUsed: Math.min(s.amtCredit ?? 0, Math.max(0, regular - tentative)) }
}

/**
 * Federal tax: regular income tax, plus any AMT above it (less a credit from earlier ISO years), plus the 3.8% net
 * investment income tax. `stateIncomeTax` (paid the same year) counts toward SALT when itemizing.
 */
export function federalTax(base: TaxBase, s: TaxSituation, stateIncomeTax = 0): number {
  const b = withTaxableSocialSecurity(base, s)
  const minimum = minimumTax(b, s, stateIncomeTax)
  return regularFederalTax(b, s, stateIncomeTax) + minimum.amt - minimum.creditUsed + netInvestmentIncomeTax(b, s)
}

/** The state's regular income tax on `income`, after `deduction`. */
function regularStateTax(table: StateTax | undefined, income: number, s: TaxSituation, deduction: number): number {
  if (!table || table.kind === "none") return 0
  const taxable = Math.max(0, income - deduction)
  if (table.kind === "flat") return taxable * (table.rate ?? 0)
  return table.brackets ? bracketTax(taxable, table.brackets[s.status], s.index) : 0
}

/** Montana-style: long-term gains on their own brackets, stacked on other taxable income. */
function separateGainsTax(table: StateTax | undefined, b: TaxBase, s: TaxSituation, brackets: Brackets, deduction: number): number {
  const other = b.ordinary + b.shortGains
  const otherTaxable = Math.max(0, other - deduction)
  const gainsTaxable = Math.max(0, b.longGains - Math.max(0, deduction - other))
  return regularStateTax(table, other, s, deduction) + bracketTax(otherTaxable + gainsTaxable, brackets, s.index) - bracketTax(otherTaxable, brackets, s.index)
}

/** A state's own itemized deductions for a homeowner: property tax and mortgage interest within its limits. */
function stateItemized(rules: StateHomeownerRules, it: Itemized, magi: number): number {
  const saltLimit = rules.followsFederalSaltCap ? saltCap(it.year, magi) : Infinity
  const propertyTax = Math.min(it.propertyTax, rules.caps?.propertyTax ?? Infinity, saltLimit)
  const interest = interestWithinLimit(it, rules.mortgageDebtLimit ?? MORTGAGE_DEBT_LIMIT)
  return Math.min(propertyTax + interest, rules.caps?.mortgageAndPropertyTax ?? Infinity, rules.caps?.total ?? Infinity)
}

/**
 * The state deduction: its standard deduction, or itemizing when the state allows it and that's larger
 * (federal-base states: the federal deduction less the state income tax in it), plus any homeowner's
 * property-tax deduction.
 */
export function stateDeduction(b: TaxBase, s: TaxSituation, table: StateTax | undefined): number {
  const rules = s.state ? STATE_HOMEOWNER[s.state] : undefined
  const it = s.itemized
  const federalStandard = FEDERAL_STANDARD_DEDUCTION[s.status] * s.index
  const standard = table?.deduction ? table.deduction[s.status] * s.index : rules?.itemize === "federal" ? federalStandard : 0
  if (!rules || !it) return standard
  const federalIt = federalItemized(b, it, 0)
  const itemizesFederally = federalIt > federalStandard
  let deduction = standard
  if (rules.itemize === "own" && (!rules.requiresFederalItemizing || itemizesFederally)) {
    deduction = Math.max(standard, stateItemized(rules, it, b.ordinary + b.shortGains + b.longGains))
  } else if (rules.itemize === "federal") {
    deduction = Math.max(standard, federalIt)
  } else if (rules.itemize === "federalExcess" && itemizesFederally) {
    deduction = standard + (federalIt - federalStandard)
  }
  return deduction + Math.min(rules.propertyTaxDeduction?.max ?? 0, it.residenceTax)
}

/** A state's property-tax credit on your home, when income is under its limit. */
function statePropertyTaxCredit(b: TaxBase, s: TaxSituation): number {
  const credit = s.state ? STATE_HOMEOWNER[s.state]?.propertyTaxCredit : undefined
  if (!credit || !s.itemized) return 0
  const income = b.ordinary + b.shortGains + b.longGains
  const full = Math.min(credit.rate * s.itemized.residenceTax, credit.max ?? Infinity)
  const limit = credit.incomeLimit?.[s.status]
  if (limit === undefined) return full
  if (income > limit) return 0
  const start = credit.phaseStart?.[s.status]
  // Shrinks evenly between the phase-out start and the limit.
  return start !== undefined && income > start ? full * ((limit - income) / (limit - start)) : full
}

/** State tax: gains are taxed like other income, except in the states in STATE_GAINS; less any homeowner credit. */
export function stateTax(base: TaxBase, s: TaxSituation): number {
  const b = stateBase(base, s)
  const table = s.state ? STATE_TAX[s.state] : undefined
  const deduction = stateDeduction(b, s, table)
  return Math.max(0, stateTaxBeforeCredits(b, s, table, deduction) - statePropertyTaxCredit(b, s))
}

function stateTaxBeforeCredits(b: TaxBase, s: TaxSituation, table: StateTax | undefined, deduction: number): number {
  const rule = s.state ? STATE_GAINS[s.state] : undefined
  const all = b.ordinary + b.shortGains + b.longGains
  const regular = (income: number) => regularStateTax(table, income, s, deduction)
  if (!rule) return regular(all)
  switch (rule.kind) {
    case "exclude":
      return regular(all - b.longGains * rule.share)
    case "deduct":
      return regular(all - Math.min(b.longGains, rule.amount))
    case "maxRate":
      return Math.min(regular(all), regular(all - b.longGains) + b.longGains * rule.rate)
    case "separate":
      return separateGainsTax(table, b, s, rule.brackets[s.status], deduction)
    case "shortSurcharge":
      return regular(all) + b.shortGains * rule.extra
    case "gainsOnly":
      return bracketTax(Math.max(0, b.longGains - b.realEstateGains - rule.deduction * s.index), rule.brackets, s.index)
  }
}

export function totalTax(b: TaxBase, s: TaxSituation): number {
  const state = stateTax(b, s)
  return federalTax(b, s, state) + state
}

export interface MarginalRates {
  ordinary: number
  shortGains: number
  longGains: number
}

/**
 * Marginal rates at this income, used to gross up withdrawals before the year's exact tax is known:
 * the next dollar of ordinary income, of short-term gains and of long-term gains.
 */
export function marginalRates(b: TaxBase, s: TaxSituation): MarginalRates {
  const step = 1_000
  const base = totalTax(b, s)
  const next = (change: Partial<TaxBase>) => (totalTax({ ...b, ...change }, s) - base) / step
  return {
    ordinary: next({ ordinary: b.ordinary + step }),
    shortGains: next({ shortGains: b.shortGains + step }),
    longGains: next({ longGains: b.longGains + step }),
  }
}
