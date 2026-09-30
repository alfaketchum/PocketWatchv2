import { resolveTiming, timingContext } from "./plan-timing"
import type { PlanDebt, PlanDocument, YearRow } from "./plan-types"

export interface LoanPayment {
  id: string
  name: string
  principal: number
  interest: number
}

type PaymentFields = Pick<YearRow, "debtPaymentsBy" | "debtInterestBy">

/** One loan's payments this year, split into principal and interest. */
export function loanSplit(row: PaymentFields, id: string): { principal: number; interest: number } {
  const paid = row.debtPaymentsBy?.[id] ?? 0
  const interest = Math.min(paid, row.debtInterestBy?.[id] ?? 0)
  return { principal: paid - interest, interest }
}

/** Each loan's payments this year split into principal and interest (loans with no payment left out). */
export function loanPayments(doc: PlanDocument, row: PaymentFields): LoanPayment[] {
  return doc.debts
    .map((d) => ({ id: d.id, name: d.name, ...loanSplit(row, d.id) }))
    .filter((p) => p.principal + p.interest >= 0.5)
}

/** Chart series keys for a loan's principal and interest parts. */
export const principalKey = (id: string) => `prin:${id}`
export const interestKey = (id: string) => `int:${id}`

/** Balances at or below this count as paid off. */
const PAID_OFF = 0.5

/**
 * The plan year (row) in which each loan is cleared, by its payments or early when what it's for is sold.
 * Loans never paid off within the plan are left out.
 */
export function loanPayoffs(doc: PlanDocument, rows: YearRow[]): { debt: PlanDebt; row: YearRow }[] {
  const ctx = timingContext(doc)
  return doc.debts.flatMap((debt) => {
    const start = Math.max(0, resolveTiming(debt.start, ctx) ?? 0)
    // Owed something at the start of the year (the loan's amount in its first year) and nothing at the end.
    const row = rows.find((r, i) => {
      if (i < start) return false
      const before = i === start ? debt.balance : rows[i - 1].debtBalances[debt.id] ?? 0
      return (r.debtBalances[debt.id] ?? 0) <= PAID_OFF && before > PAID_OFF
    })
    return row ? [{ debt, row }] : []
  })
}

export const PAYOFF_ICON = "credit_score"
export const payoffName = (debt: PlanDebt) => `${debt.name} paid off`
