import { simulatePlan } from "./engine/simulate"
import { loanSchedule } from "./plan-amortization"
import { scheduledPayment } from "./plan-debt-payments"
import { deflator } from "./plan-dollars"
import { expandPlan } from "./plan-expand"
import { inflationOf } from "./plan-inflation"
import { withLoanOption, type LoanChoice, type LoanOption } from "./plan-loan-options"
import { rowTaxes } from "./plan-row-taxes"
import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDocument, YearRow } from "./plan-types"

/** A year counts as having run out of money when this much (or more) spending goes unfunded. */
const SHORTFALL = 0.5
/** Breakeven search: returns shifted up to ±20 points, bisected this many times. */
const SHIFT_RANGE = 0.2
const SHIFT_STEPS = 24

export interface LoanOutcome {
  option: LoanOption
  doc: PlanDocument
  /** First month's payment, extra included, in the loan's first-year dollars. */
  payment: number
  payoffYear: number | null
  /** Interest paid on this loan within the plan, today's dollars. */
  interest: number
  /** Net worth (homes included, loans subtracted), today's dollars. */
  netWorthAtRetirement: number | null
  netWorthEnd: number
  accountsEnd: number
  lifetimeTax: number
  runsOutAge: number | null
  /** Year-end net worth by plan year, today's dollars. */
  netWorth: number[]
  years: number[]
}

function retirementIndex(doc: PlanDocument): number | null {
  const retirement = doc.milestones.find((m) => m.kind === "retirement")
  return retirement ? resolveTiming(retirement.timing, timingContext(doc)) : null
}

/** One option run through the whole plan. */
export function loanOutcome(doc: PlanDocument, choice: LoanChoice, option: LoanOption): LoanOutcome {
  const variant = withLoanOption(doc, choice, option)
  const inflation = inflationOf(variant.settings)
  const { rows } = simulatePlan(variant)
  const real = (r: YearRow, value: number) => value / deflator(inflation, r.index, "balance")
  const flow = (r: YearRow, value: number) => value / deflator(inflation, r.index, "flow")
  const view = expandPlan(variant)
  const debt = view.debts.find((d) => d.id === choice.id)
  const schedule = loanSchedule(view, choice.id)
  const retire = retirementIndex(variant)
  const atRetire = retire !== null ? rows[retire] : undefined
  const last = rows[rows.length - 1]
  const short = rows.find((r) => r.shortfall > SHORTFALL)
  return {
    option,
    doc: variant,
    payment: debt ? scheduledPayment(debt, 0) : 0,
    payoffYear: schedule?.payoffYear ?? null,
    interest: rows.reduce((s, r) => s + flow(r, r.debtInterestBy[choice.id] ?? 0), 0),
    netWorthAtRetirement: atRetire ? real(atRetire, atRetire.netWorth) : null,
    netWorthEnd: last ? real(last, last.netWorth) : 0,
    accountsEnd: last ? real(last, last.accountsTotal) : 0,
    lifetimeTax: rows.reduce((s, r) => s + flow(r, rowTaxes(r)), 0),
    runsOutAge: short ? (short.ages[0] ?? null) : null,
    netWorth: rows.map((r) => real(r, r.netWorth)),
    years: rows.map((r) => r.year),
  }
}

export function compareLoanOptions(doc: PlanDocument, choice: LoanChoice, options: LoanOption[]): LoanOutcome[] {
  return options.map((o) => loanOutcome(doc, choice, o))
}

/** Every invested account's return moved by `shift` (cash stays as it is). */
function withReturnShift(doc: PlanDocument, shift: number): PlanDocument {
  return { ...doc, accounts: doc.accounts.map((a) => (a.taxTreatment === "cash" ? a : { ...a, returnRate: a.returnRate + shift })) }
}

/** Return the plan assumes on invested money: balance-weighted (a plain average when nothing's invested yet). */
export function assumedReturn(doc: PlanDocument): number | null {
  const invested = doc.accounts.filter((a) => a.taxTreatment !== "cash")
  if (invested.length === 0) return null
  const total = invested.reduce((s, a) => s + a.balance, 0)
  return total > 0
    ? invested.reduce((s, a) => s + a.balance * a.returnRate, 0) / total
    : invested.reduce((s, a) => s + a.returnRate, 0) / invested.length
}

/** Net worth at the end, today's dollars, less any spending that went unfunded. */
function score(doc: PlanDocument): number {
  const { rows } = simulatePlan(doc)
  const inflation = inflationOf(doc.settings)
  const last = rows[rows.length - 1]
  const unfunded = rows.reduce((s, r) => s + r.shortfall / deflator(inflation, r.index, "flow"), 0)
  return (last ? last.netWorth / deflator(inflation, last.index, "balance") : 0) - unfunded
}

/**
 * The yearly return on invested money at which investing ends level with paying the loan down: above it,
 * investing comes out ahead. Taxes, deductions and inflation are all in, because the whole plan is rerun.
 * Null when one side wins across the whole range searched.
 */
export function breakEvenReturn(doc: PlanDocument, choice: LoanChoice, prepay: LoanOption): number | null {
  const base = assumedReturn(doc)
  if (base === null) return null
  const prepaid = withLoanOption(doc, choice, prepay)
  const investWins = (shift: number) => score(withReturnShift(doc, shift)) >= score(withReturnShift(prepaid, shift))
  if (investWins(-SHIFT_RANGE) || !investWins(SHIFT_RANGE)) return null
  let lo = -SHIFT_RANGE
  let hi = SHIFT_RANGE
  for (let i = 0; i < SHIFT_STEPS; i++) {
    const mid = (lo + hi) / 2
    if (investWins(mid)) hi = mid
    else lo = mid
  }
  return base + hi
}
