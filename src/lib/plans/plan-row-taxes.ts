import type { YearRow } from "./plan-types"

/** Each kind of tax a plan year records, with its chart key and label. */
export const TAX_PARTS = [
  { key: "tax:income", label: "Income tax", field: "incomeTax" },
  { key: "tax:payroll", label: "Payroll tax", field: "payrollTax" },
  { key: "tax:withdrawal", label: "Tax on withdrawals", field: "withdrawalTax" },
  { key: "tax:sale", label: "Tax on asset sales", field: "saleTax" },
  { key: "tax:trading", label: "Tax on trading gains", field: "tradingTax" },
  { key: "tax:penalty", label: "Early-withdrawal penalty", field: "earlyWithdrawalPenalty" },
] as const

type TaxField = (typeof TAX_PARTS)[number]["field"]

/** Every tax paid in a year (each kind in TAX_PARTS), the early-withdrawal penalty included. */
export function rowTaxes(r: Pick<YearRow, TaxField>): number {
  return TAX_PARTS.reduce((sum, t) => sum + r[t.field], 0)
}

/** Income left after income and payroll tax (before spending and saving). */
export function afterTaxIncome(r: Pick<YearRow, "income" | "incomeTax" | "payrollTax">): number {
  return r.income - r.incomeTax - r.payrollTax
}
