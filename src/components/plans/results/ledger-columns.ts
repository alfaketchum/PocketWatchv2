import type { PlanDocument, YearRow } from "@/lib/plans/plan-types"

/** What a column holds: money that flows during the year (totals add up), a year-end balance, or a rate. */
export type LedgerKind = "flow" | "balance" | "rate"

export interface LedgerContext {
  doc: PlanDocument
  /** Accounts total going into this year (last year's close, or the plan's starting balances). */
  startBalance: number
}

export interface LedgerColumn {
  id: string
  label: string
  hint: string
  kind: LedgerKind
  /** Shown red (money out) or green (money saved). */
  tone?: "neg" | "pos"
  value: (row: YearRow, ctx: LedgerContext) => number | null
}

const taxes = (r: YearRow) => r.incomeTax + r.withdrawalTax + r.saleTax + r.tradingTax
const interest = (r: YearRow) => Math.min(r.debtPayments, r.debtInterest)
const liquidTreatments = new Set(["cash", "taxable"])

export const LEDGER_COLUMNS: LedgerColumn[] = [
  { id: "income", label: "Income", hint: "Pay, business, rent, pensions, Social Security", kind: "flow", value: (r) => r.income },
  { id: "received", label: "Received", hint: "Inherited or gifted money landing in accounts (not income)", kind: "flow", value: (r) => r.deposits },
  { id: "splitOut", label: "Split out", hint: "Account shares moved to an ex-spouse in a divorce (not taxed)", kind: "flow", tone: "neg", value: (r) => -r.splitOut },
  { id: "withdrawals", label: "Withdrawn", hint: "Taken from accounts to cover the year, tax on those withdrawals included", kind: "flow", tone: "neg", value: (r) => -r.withdrawals },
  { id: "assetSales", label: "Asset sales", hint: "Proceeds from selling homes, cars and other assets", kind: "flow", value: (r) => Math.max(0, r.assetSales) },
  { id: "spending", label: "Spending", hint: "Every spending line, kids and home/vehicle running costs", kind: "flow", tone: "neg", value: (r) => -r.expenses },
  { id: "taxes", label: "Taxes", hint: "All taxes: income, withdrawals, asset sales and trading", kind: "flow", tone: "neg", value: (r) => -taxes(r) },
  { id: "incomeTax", label: "Income tax", hint: "Federal and state tax on earned income (after the bracket true-up)", kind: "flow", tone: "neg", value: (r) => -r.incomeTax },
  { id: "withdrawalTax", label: "Withdrawal tax", hint: "Tax on money taken from tax-deferred and taxable accounts", kind: "flow", tone: "neg", value: (r) => -r.withdrawalTax },
  { id: "saleTax", label: "Sale tax", hint: "Capital-gains tax on assets sold", kind: "flow", tone: "neg", value: (r) => -r.saleTax },
  { id: "tradingTax", label: "Trading tax", hint: "Tax on gains realized by active trading", kind: "flow", tone: "neg", value: (r) => -r.tradingTax },
  { id: "debtPayments", label: "Debt payments", hint: "Loan payments: principal plus interest", kind: "flow", tone: "neg", value: (r) => -r.debtPayments },
  { id: "principal", label: "Principal", hint: "The part of loan payments that pays the balance down", kind: "flow", tone: "neg", value: (r) => -(r.debtPayments - interest(r)) },
  { id: "interest", label: "Interest", hint: "The part of loan payments that is interest", kind: "flow", tone: "neg", value: (r) => -interest(r) },
  { id: "assetPurchases", label: "Purchases", hint: "Homes, cars and other assets bought (down payments for financed ones)", kind: "flow", tone: "neg", value: (r) => -(r.assetPurchases + Math.max(0, -r.assetSales)) },
  { id: "contributions", label: "Contributions", hint: "Into savings and investment accounts: payroll contributions plus what's left over", kind: "flow", tone: "pos", value: (r) => r.contributions - r.employerMatch },
  { id: "employerMatch", label: "Employer match", hint: "Added by employers on top of your contributions", kind: "flow", tone: "pos", value: (r) => r.employerMatch },
  { id: "shortfall", label: "Shortfall", hint: "Spending the accounts couldn't cover: the money ran out", kind: "flow", tone: "neg", value: (r) => -r.shortfall },
  { id: "growth", label: "Growth", hint: "Investment growth on the accounts", kind: "flow", tone: "pos", value: (r) => r.growth },
  { id: "realizedGains", label: "Realized gains", hint: "Gains realized by trading (taxed this year)", kind: "flow", value: (r) => r.realizedGains },
  { id: "taxableIncome", label: "Taxable income", hint: "Earned income after pre-tax contributions, plus taxable withdrawals and gains", kind: "flow", value: (r) => r.taxableIncome },
  { id: "deduction", label: "Deduction", hint: "Federal deduction taken: standard, or itemized (marked *) when larger", kind: "flow", value: (r) => r.deduction?.amount ?? null },
  { id: "effectiveRate", label: "Effective tax", hint: "All taxes ÷ taxable income", kind: "rate", value: (r) => (r.taxableIncome > 0.5 ? taxes(r) / r.taxableIncome : null) },
  { id: "returnRate", label: "Return", hint: "Investment growth ÷ accounts at the start of the year", kind: "rate", value: (r, c) => (c.startBalance > 0.5 ? r.growth / c.startBalance : null) },
  {
    id: "savingsRate",
    label: "Savings rate",
    hint: "Share of after-tax income not spent or used on debt",
    kind: "rate",
    value: (r) => {
      const afterTax = r.income - r.incomeTax
      return afterTax > 0.5 ? (afterTax - r.expenses - r.debtPayments) / afterTax : null
    },
  },
  { id: "withdrawalRate", label: "Withdrawal rate", hint: "Withdrawals ÷ accounts at the start of the year", kind: "rate", value: (r, c) => (r.withdrawals > 0.5 && c.startBalance > 0.5 ? r.withdrawals / c.startBalance : null) },
  { id: "invested", label: "Invested", hint: "All account balances at year end", kind: "balance", value: (r) => r.accountsTotal },
  {
    id: "liquid",
    label: "Liquid",
    hint: "Cash and taxable investments: reachable without penalties or selling property",
    kind: "balance",
    value: (r, c) => c.doc.accounts.filter((a) => liquidTreatments.has(a.taxTreatment)).reduce((s, a) => s + (r.balances[a.id] ?? 0), 0),
  },
  { id: "property", label: "Property", hint: "Homes, cars and other assets at what they're worth", kind: "balance", value: (r) => r.assetsTotal },
  { id: "debtOwed", label: "Debt owed", hint: "What's still owed on every loan at year end", kind: "balance", tone: "neg", value: (r) => -r.debtsTotal },
  { id: "netWorth", label: "Net worth", hint: "Accounts plus property minus debt, at year end", kind: "balance", value: (r) => r.netWorth },
]

export const LEDGER_VIEWS = {
  summary: { label: "Summary", columns: ["income", "taxes", "spending", "debtPayments", "contributions", "withdrawals", "invested", "netWorth"] },
  cashflow: {
    label: "Cash flow",
    columns: ["income", "received", "splitOut", "withdrawals", "assetSales", "spending", "taxes", "debtPayments", "assetPurchases", "contributions", "employerMatch", "shortfall"],
  },
  taxes: { label: "Taxes", columns: ["taxableIncome", "deduction", "incomeTax", "withdrawalTax", "saleTax", "tradingTax", "taxes", "effectiveRate", "realizedGains"] },
  balances: {
    label: "Balances & debt",
    columns: ["growth", "returnRate", "invested", "liquid", "property", "principal", "interest", "debtOwed", "netWorth", "savingsRate", "withdrawalRate"],
  },
  all: { label: "Everything", columns: LEDGER_COLUMNS.map((c) => c.id) },
} as const

export type LedgerView = keyof typeof LEDGER_VIEWS

export function columnsFor(view: LedgerView): LedgerColumn[] {
  const ids = LEDGER_VIEWS[view].columns as readonly string[]
  return LEDGER_COLUMNS.filter((c) => ids.includes(c.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
}

/** Accounts going into each year: the previous year's close, or the plan's starting balances. */
export function startBalances(doc: PlanDocument, rows: YearRow[]): number[] {
  const opening = doc.accounts.reduce((s, a) => s + a.balance, 0)
  return rows.map((_, i) => (i === 0 ? opening : rows[i - 1].accountsTotal))
}

/** Lifetime row: flows add up; balances show the last year; rates are left blank. */
export function lifetimeValue(column: LedgerColumn, rows: YearRow[], ctx: (i: number) => LedgerContext): number | null {
  if (column.kind === "rate" || rows.length === 0) return null
  if (column.kind === "balance") return column.value(rows[rows.length - 1], ctx(rows.length - 1))
  return rows.reduce((s, r, i) => s + (column.value(r, ctx(i)) ?? 0), 0)
}
