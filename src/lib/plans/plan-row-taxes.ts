import type { YearRow } from "./plan-types"

/** Every tax paid in a year: income, payroll, on withdrawals, on asset sales and on trading. */
export function rowTaxes(r: Pick<YearRow, "incomeTax" | "payrollTax" | "withdrawalTax" | "saleTax" | "tradingTax">): number {
  return r.incomeTax + r.payrollTax + r.withdrawalTax + r.saleTax + r.tradingTax
}

/** Income left after income and payroll tax (before spending and saving). */
export function afterTaxIncome(r: Pick<YearRow, "income" | "incomeTax" | "payrollTax">): number {
  return r.income - r.incomeTax - r.payrollTax
}
