import { TAX_TREATMENT_LABELS } from "./plan-constants"
import { layersFor } from "./plan-chart"
import { loanPayments, type LoanPayment } from "./plan-loan-parts"
import type { PlanDocument, TaxTreatment, YearRow } from "./plan-types"
import { afterTaxIncome, rowTaxes, TAX_PARTS } from "./plan-row-taxes"

export interface Allocation {
  id: string
  name: string
  treatment: TaxTreatment
  balance: number
  /** Share of all account balances. */
  share: number
}

export interface TaxBalance {
  cash: number
  taxable: number
  taxDeferred: number
  taxFree: number
}

/** One plan year read like a personal P&L. Values are in whatever dollar basis `rows` are in. */
export interface YearMetrics {
  netWorth: number
  netWorthChange: number
  /** Cash plus taxable investments: reachable without penalties or selling property. */
  liquidNetWorth: number
  income: number
  taxableIncome: number
  taxes: number
  /** Each kind of tax paid this year (kinds with none left out). */
  taxesBy: { label: string; value: number }[]
  /** Taxes over taxable income; null when there is none. */
  effectiveTaxRate: number | null
  /** Federal deduction taken (brackets only): standard, or itemized when larger. */
  deduction: { amount: number; itemized: boolean; senior?: number } | null
  /** Spending streams only. */
  spending: number
  /** Each spending line this year, largest first. */
  spendingBy: { id: string; name: string; value: number }[]
  debtPayments: number
  assetPurchases: number
  /** Everything paid out: spending, debt payments, taxes and asset purchases. */
  expenses: number
  /** Loan payments this year, each split into principal and interest. */
  loans: LoanPayment[]
  /** Share of after-tax income kept; null without income. */
  savingsRate: number | null
  /** What you put into savings and investment accounts: payroll contributions plus leftover cash flow. */
  contributions: number
  contributionsBy: { id: string; name: string; value: number }[]
  /** Added by employers on top; never passes through your cash flow. */
  employerMatch: number
  /** Inherited or gifted money that landed straight in accounts. */
  received: number
  /** Account shares moved to an ex-spouse (divorce split). */
  splitOut: number
  /** Gross withdrawals from accounts (taxes on them included). */
  withdrawals: number
  /** Withdrawals over the accounts' start-of-year balance; null when nothing is withdrawn. */
  withdrawalRate: number | null
  taxBalance: TaxBalance
  allocations: Allocation[]
  incomeSources: { label: string; value: number }[]
  investmentGrowth: number
  assetAppreciation: number
  assetDepreciation: number
}

function incomeSources(doc: PlanDocument, row: YearRow): { label: string; value: number }[] {
  const streams = doc.incomes.map((i) => ({ label: i.name, value: row.incomeBy[i.id] ?? 0 }))
  const withdrawals = doc.accounts.map((a) => ({ label: `Withdrawn from ${a.name}`, value: row.withdrawalsBy[a.id] ?? 0 }))
  return [...streams, { label: "Employer match", value: row.employerMatch }, ...withdrawals].filter((s) => Math.abs(s.value) >= 0.5)
}

function allocations(doc: PlanDocument, row: YearRow): Allocation[] {
  const total = row.accountsTotal
  return doc.accounts
    .map((a) => {
      const balance = row.balances[a.id] ?? 0
      return { id: a.id, name: a.name, treatment: a.taxTreatment, balance, share: total > 0 ? balance / total : 0 }
    })
    .filter((a) => a.balance >= 0.5)
    .sort((a, b) => b.balance - a.balance)
}

/** P&L-style metrics for year `index`; the previous year's close (or the plan start) sets the change. */
export function yearMetrics(doc: PlanDocument, rows: YearRow[], index: number, startNetWorth: number): YearMetrics | null {
  const row = rows[index]
  if (!row) return null
  const previous = index > 0 ? rows[index - 1].netWorth : startNetWorth
  const layers = layersFor(doc, { accounts: row.balances, assets: row.assetValues, debts: row.debtBalances })
  const taxes = rowTaxes(row)
  const afterTax = afterTaxIncome(row)
  const kept = afterTax - row.expenses - row.debtPayments
  const startBalance = index > 0 ? rows[index - 1].accountsTotal : doc.accounts.reduce((sum, a) => sum + a.balance, 0)
  return {
    netWorth: row.netWorth,
    netWorthChange: row.netWorth - previous,
    liquidNetWorth: layers.cash + layers.taxable,
    income: row.income,
    taxableIncome: row.taxableIncome,
    taxes,
    taxesBy: TAX_PARTS.map((t) => ({ label: t.label, value: row[t.field] })).filter((t) => t.value >= 0.5),
    effectiveTaxRate: row.taxableIncome > 0.5 ? taxes / row.taxableIncome : null,
    deduction: row.deduction ?? null,
    spending: row.expenses,
    spendingBy: doc.expenses
      .map((e) => ({ id: e.id, name: e.name, value: row.expensesBy[e.id] ?? 0 }))
      .filter((e) => e.value >= 0.5)
      .sort((a, b) => b.value - a.value),
    debtPayments: row.debtPayments,
    assetPurchases: row.assetPurchases,
    expenses: row.expenses + row.debtPayments + taxes + row.assetPurchases,
    loans: loanPayments(doc, row),
    savingsRate: afterTax > 0.5 ? kept / afterTax : null,
    contributions: row.contributions - row.employerMatch,
    contributionsBy: doc.accounts
      .map((a) => ({ id: a.id, name: a.name, value: (row.contributionsBy[a.id] ?? 0) - (row.employerMatchBy[a.id] ?? 0) }))
      .filter((c) => c.value >= 0.5),
    employerMatch: row.employerMatch,
    received: row.deposits,
    splitOut: row.splitOut,
    withdrawals: row.withdrawals,
    withdrawalRate: row.withdrawals > 0.5 && startBalance > 0 ? row.withdrawals / startBalance : null,
    taxBalance: { cash: layers.cash, taxable: layers.taxable, taxDeferred: layers.taxDeferred, taxFree: layers.taxFree + layers.taxFree529 },
    allocations: allocations(doc, row),
    incomeSources: incomeSources(doc, row),
    investmentGrowth: row.growth,
    assetAppreciation: row.assetAppreciation,
    assetDepreciation: row.assetDepreciation,
  }
}

export const TAX_BALANCE_LABELS: Record<keyof TaxBalance, string> = {
  cash: TAX_TREATMENT_LABELS.cash,
  taxable: TAX_TREATMENT_LABELS.taxable,
  taxDeferred: "Tax-deferred",
  taxFree: "Tax-free",
}
