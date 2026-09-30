import type { PlanDocument, YearRow } from "./plan-types"

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
