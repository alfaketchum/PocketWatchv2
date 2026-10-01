import { loanSchedule } from "./plan-amortization"
import { monthlyPayment, requiredPayment } from "./plan-debt-payments"
import { expandPlan, generatedDebts } from "./plan-expand"
import { effectiveFinancing } from "./plan-financing"
import { inflationOf, priceIndex } from "./plan-inflation"
import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDebt, PlanDocument } from "./plan-types"

export const LOAN_TERMS = [15, 20, 30] as const
export type LoanTerm = (typeof LOAN_TERMS)[number]

/**
 * How much lower a shorter mortgage's rate typically is than a 30-year's. 15-year: Freddie Mac PMMS, 10-year
 * average gap to the 30-year (0.67 points; 0.68 on 2026-10-01). 20-year: no survey series, so about halfway.
 */
export const TERM_SPREADS: Record<LoanTerm, number> = { 30: 0, 20: 0.0035, 15: 0.0067 }

/** Payoff targets offered when the loan would otherwise run longer. */
const PAYOFF_YEARS = [10, 15, 20] as const

/** A loan the options can be tried on. */
export interface LoanChoice {
  id: string
  name: string
  kind: PlanDebt["kind"]
  /** Owed when it starts (that year's dollars). */
  balance: number
  rate: number
  /** Required monthly payment, before any extra. */
  required: number
  extra: number
  startIndex: number
  startYear: number
  /** Years left on its own schedule, without any extra. */
  yearsLeft: number | null
  /** A future purchase's loan, set on the asset: its term and rate can still be chosen. */
  assetId: string | null
  termYears: number | null
}

export type LoanOption =
  | { key: "planned" }
  | { key: "extra"; extraMonthly: number }
  | { key: "payoff"; years: number; extraMonthly: number }
  | { key: "term"; years: LoanTerm; rate: number }

const AMORTIZING = new Set<PlanDebt["kind"]>(["mortgage", "auto", "student", "other"])

function yearsLeft(view: PlanDocument, debt: PlanDebt): number | null {
  const schedule = loanSchedule(view, debt.id)
  if (!schedule || schedule.neverPaysOff || schedule.payoffYear === null) return null
  return schedule.payoffYear - (schedule.years[0]?.year ?? schedule.payoffYear) + 1
}

/** Loans the comparison can work on: amortizing loans you have or that a planned purchase takes out. */
export function loanChoices(doc: PlanDocument): LoanChoice[] {
  const view = expandPlan(doc)
  const ctx = timingContext(view)
  const generated = new Map(generatedDebts(doc).map((g) => [g.debt.id, g.assetId]))
  return view.debts
    .filter((d) => AMORTIZING.has(d.kind) && d.balance > 0 && !d.id.includes("~"))
    .filter((d) => doc.debts.some((own) => own.id === d.id) || generated.has(d.id))
    .map((d) => {
      const startIndex = Math.max(0, resolveTiming(d.start, ctx) ?? 0)
      const assetId = generated.get(d.id) ?? null
      const asset = assetId ? doc.assets.find((a) => a.id === assetId) : undefined
      const plain = { ...d, extraMonthly: 0 }
      return {
        id: d.id,
        name: d.name,
        kind: d.kind,
        balance: d.balance,
        rate: d.rate,
        required: requiredPayment(d, 0),
        extra: d.extraMonthly ?? 0,
        startIndex,
        startYear: view.settings.startYear + startIndex,
        yearsLeft: yearsLeft({ ...view, debts: view.debts.map((x) => (x.id === d.id ? plain : x)) }, d),
        assetId,
        termYears: asset ? (effectiveFinancing(asset)?.termYears ?? null) : null,
      }
    })
}

/** Extra each month that clears the loan in `years` from its start; null when it already does. */
export function payoffExtra(choice: LoanChoice, years: number): number | null {
  const needed = monthlyPayment(choice.balance, choice.rate, years * 12) - choice.required
  return needed > 0.5 ? needed : null
}

function nearestTerm(years: number): LoanTerm {
  return years >= 25 ? 30 : years >= 18 ? 20 : 15
}

/** Typical rate for each term, from the loan's own rate and term and the usual gaps between terms. */
export function termRates(choice: LoanChoice): Record<LoanTerm, number> {
  const rate30 = choice.rate + TERM_SPREADS[nearestTerm(choice.termYears ?? 30)]
  return { 30: rate30, 20: Math.max(0, rate30 - TERM_SPREADS[20]), 15: Math.max(0, rate30 - TERM_SPREADS[15]) }
}

/** The options worth comparing for a loan: as planned, a custom extra, payoff targets, and terms for mortgages not taken yet. */
export function loanOptions(choice: LoanChoice, customExtra: number, rates: Record<LoanTerm, number>): LoanOption[] {
  const payoffs = PAYOFF_YEARS.flatMap((years): LoanOption[] => {
    const extra = choice.yearsLeft !== null && choice.yearsLeft > years + 1 ? payoffExtra(choice, years) : null
    return extra === null ? [] : [{ key: "payoff", years, extraMonthly: extra }]
  })
  const terms: LoanOption[] = choice.assetId && choice.kind === "mortgage"
    ? LOAN_TERMS.filter((t) => t !== choice.termYears).map((years) => ({ key: "term", years, rate: rates[years] }))
    : []
  return [{ key: "planned" }, { key: "extra", extraMonthly: customExtra }, ...payoffs, ...terms]
}

export function optionLabel(option: LoanOption): string {
  switch (option.key) {
    case "planned":
      return "As planned"
    case "extra":
      return "Pay extra each month"
    case "payoff":
      return `Pay it off in ${option.years} years`
    case "term":
      return `${option.years}-year loan`
  }
}

/** The plan with the option applied to the loan: on the debt itself, or on its asset's "How you'll pay". */
export function withLoanOption(doc: PlanDocument, choice: LoanChoice, option: LoanOption): PlanDocument {
  if (option.key === "planned") return doc
  if (!choice.assetId) {
    if (option.key === "term") return doc
    return { ...doc, debts: doc.debts.map((d) => (d.id === choice.id ? { ...d, extraMonthly: option.extraMonthly } : d)) }
  }
  // A future purchase: its financing is in today's dollars, the loan in its first year's.
  const toToday = 1 / priceIndex(inflationOf(doc.settings), choice.startIndex)
  return {
    ...doc,
    assets: doc.assets.map((a) => {
      const terms = a.id === choice.assetId ? effectiveFinancing(a) : null
      if (!terms || !a.financing) return a
      const financing =
        option.key === "term"
          ? { ...a.financing, ...terms, mode: "loan" as const, termYears: option.years, rate: option.rate, extraMonthly: undefined }
          : { ...a.financing, ...terms, extraMonthly: option.extraMonthly * toToday }
      return { ...a, financing }
    }),
  }
}
