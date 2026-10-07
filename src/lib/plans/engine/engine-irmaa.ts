/**
 * Medicare IRMAA surcharges: from 65, each person on Medicare pays extra Part B and D premiums when MAGI from two
 * years earlier passes the tier lines. Counted like a tax (it's caused by income, not chosen spending). The filers
 * counted are the plan's first person, and the second on a joint return (as for the senior deduction).
 * Assumptions: the two years before the plan had the first year's earned income; the surcharge amounts grow with
 * the plan's inflation; base premiums are left to the plan's own healthcare spending.
 */
import { magi } from "../tax/conversion-room"
import type { FilingStatus } from "../tax/federal-2026"
import { IRMAA_LOOKBACK_YEARS, IRMAA_MONTHLY_SURCHARGE, irmaaTierFor, MEDICARE_AGE } from "../tax/irmaa-2026"
import { ageInYear } from "../tax/retirement-rules-2026"
import { taxBase } from "../tax/tax-calc"
import type { PlanDocument } from "../plan-types"
import { finalBase, type TaxedAmounts, type YearTax } from "./engine-tax"

const MONTHS = 12

/** People on Medicare this year among the filers. */
export function medicareEnrollees(doc: PlanDocument, status: FilingStatus, year: number): number {
  const filers = status === "joint" ? doc.people.slice(0, 2) : doc.people.slice(0, 1)
  return filers.filter((p) => ageInYear(p, year) >= MEDICARE_AGE).length
}

/** The year's MAGI on its final totals. Flat rates have no Social Security rules, so it's taxable income there. */
export function yearMagi(tax: YearTax, amounts: Omit<TaxedAmounts, "charged">): number {
  const base = finalBase(tax, amounts)
  if (tax.situation) return magi(base, tax.situation)
  return base.ordinary + base.shortGains + base.longGains
}

/** MAGI from earned income alone (pay, pensions, Social Security): the stand-in for the years before the plan. */
export function earnedMagi(tax: YearTax): number {
  const base = taxBase({ ordinary: tax.earnedOrdinary, socialSecurity: tax.socialSecurity })
  return tax.situation ? magi(base, tax.situation) : base.ordinary
}

export interface IrmaaYear {
  tier: number
  surcharge: number
}

export const NO_IRMAA: IrmaaYear = { tier: 0, surcharge: 0 }

/** The MAGI a year's premiums look back to: the simulated year two before, or the stand-in before the plan. */
export function lookbackMagi(history: number[], index: number, seed: number): number {
  const at = index - IRMAA_LOOKBACK_YEARS
  return at >= 0 ? (history[at] ?? seed) : seed
}

/** This year's surcharge: enrollees × 12 × the tier's monthly amount, in this year's dollars (`index` from 2026). */
export function irmaaYear(doc: PlanDocument, status: FilingStatus, year: number, index: number, lookback: number): IrmaaYear {
  const enrollees = medicareEnrollees(doc, status, year)
  if (enrollees === 0) return NO_IRMAA
  const tier = irmaaTierFor(lookback, status, index, year)
  if (tier === 0) return NO_IRMAA
  return { tier, surcharge: enrollees * MONTHS * IRMAA_MONTHLY_SURCHARGE[tier - 1] * index }
}
