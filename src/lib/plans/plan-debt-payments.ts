import type { HelocTerms, PlanDebt } from "./plan-types"

const MONTHS_PER_YEAR = 12

/** Typical HELOC: a 10-year draw period, then 20 years to repay. */
export const HELOC_DEFAULTS: HelocTerms = { drawYears: 10, repayYears: 20, forHome: false }

/** Level monthly payment that pays `loan` off over `months` at `annualRate`. */
export function monthlyPayment(loan: number, annualRate: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0
  const r = annualRate / MONTHS_PER_YEAR
  return r === 0 ? loan / months : (loan * r) / (1 - Math.pow(1 + r, -months))
}

/** HELOC terms when the debt is one (stored terms, or the typical ones). */
export function helocTerms(debt: Pick<PlanDebt, "kind" | "heloc">): HelocTerms | null {
  return debt.kind === "heloc" ? debt.heloc ?? HELOC_DEFAULTS : null
}

type PaymentFields = Pick<PlanDebt, "kind" | "heloc" | "balance" | "rate" | "monthlyPayment" | "extraMonthly">

/**
 * Monthly payment due `yearsIn` years after the debt starts, before any extra. A HELOC pays only interest
 * through its draw period (so the balance holds), then a level payment that clears it over the repayment years.
 */
export function requiredPayment(debt: PaymentFields, yearsIn: number): number {
  const terms = helocTerms(debt)
  if (!terms) return debt.monthlyPayment
  if (yearsIn < terms.drawYears) return (debt.balance * debt.rate) / MONTHS_PER_YEAR
  return monthlyPayment(debt.balance, debt.rate, terms.repayYears * MONTHS_PER_YEAR)
}

/** What's paid each month `yearsIn` years after the debt starts: the required payment plus any extra principal. */
export function scheduledPayment(debt: PaymentFields, yearsIn: number): number {
  return requiredPayment(debt, yearsIn) + (debt.extraMonthly ?? 0)
}

/** Whether a debt's interest counts as home mortgage interest when it's against a home you live in. */
export function isHomeLoanInterest(debt: Pick<PlanDebt, "kind" | "heloc">): boolean {
  const terms = helocTerms(debt)
  return terms ? terms.forHome : true
}
