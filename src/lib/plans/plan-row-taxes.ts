import type { YearRow } from "./plan-types"

/** Each kind of tax a plan year pays, by the kind of income it's on, with its chart key and label. */
export const TAX_PARTS = [
  { key: "tax:income", label: "Income tax", field: "ordinaryIncomeTax" },
  { key: "tax:short", label: "Short-term gains tax", field: "shortGainsTax" },
  { key: "tax:long", label: "Long-term gains tax", field: "longGainsTax" },
  { key: "tax:payroll", label: "Payroll tax", field: "payrollTax" },
  { key: "tax:penalty", label: "Early-withdrawal penalty", field: "earlyWithdrawalPenalty" },
] as const

type TaxField = (typeof TAX_PARTS)[number]["field"]

/** Every tax paid in a year (each kind in TAX_PARTS), the early-withdrawal penalty included. */
export function rowTaxes(r: Pick<YearRow, TaxField>): number {
  return TAX_PARTS.reduce((sum, t) => sum + r[t.field], 0)
}

/** Income left after the income and payroll tax on it (before spending and saving); gains and withdrawals aside. */
export function afterTaxIncome(r: Pick<YearRow, "income" | "earnedIncomeTax" | "payrollTax">): number {
  return r.income - r.earnedIncomeTax - r.payrollTax
}
