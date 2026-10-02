import type { YearRow } from "./plan-types"

/** Each kind of tax a plan year records, with its chart key and label. */
export const TAX_PARTS = [
  { key: "tax:income", label: "Income tax", field: "incomeTax" },
  { key: "tax:payroll", label: "Payroll tax", field: "payrollTax" },
  { key: "tax:withdrawal", label: "Tax on withdrawals", field: "withdrawalTax" },
  { key: "tax:sale", label: "Tax on asset sales", field: "saleTax" },
  { key: "tax:trading", label: "Tax on trading gains", field: "tradingTax" },
] as const

/** Every tax paid in a year: income, payroll, on withdrawals, on asset sales and on trading. */
export function rowTaxes(r: Pick<YearRow, "incomeTax" | "payrollTax" | "withdrawalTax" | "saleTax" | "tradingTax">): number {
  return r.incomeTax + r.payrollTax + r.withdrawalTax + r.saleTax + r.tradingTax
}

/** Income left after income and payroll tax (before spending and saving). */
export function afterTaxIncome(r: Pick<YearRow, "income" | "incomeTax" | "payrollTax">): number {
  return r.income - r.incomeTax - r.payrollTax
}
