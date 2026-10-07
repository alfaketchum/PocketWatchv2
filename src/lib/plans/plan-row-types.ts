import type { HomeFallback } from "./plan-types"

// Results of simulating a plan: one row per year, the projection and its summary.

/** One simulated year. Flows are for the year; balances are at year end. */
export interface YearRow {
  index: number
  year: number
  ages: number[]
  income: number
  incomeBy: Record<string, number>
  employerMatch: number
  employerMatchBy: Record<string, number>
  incomeTax: number
  /** Social Security and Medicare on wages, and self-employment tax. */
  payrollTax: number
  withdrawalTax: number
  /**
   * The year's income tax by kind of income (they add up to incomeTax + withdrawalTax + saleTax + tradingTax, which
   * are how it was charged along the way): ordinary income, short-term gains, long-term gains.
   */
  ordinaryIncomeTax: number
  shortGainsTax: number
  longGainsTax: number
  /** Tax on earned income alone (for after-tax income and the savings rate). */
  earnedIncomeTax: number
  /** The 10% additional tax on traditional withdrawals before 59½. */
  earlyWithdrawalPenalty: number
  /** Capital-gains tax on assets sold this year (after any home-sale exclusion). */
  saleTax: number
  /** Tax on gains realized by trading inside taxable accounts. */
  tradingTax: number
  /** Gains realized by trading this year (short- and long-term). */
  realizedGains: number
  /** One-time deposits straight into accounts (inheritance, gifts); not part of cash flow. */
  deposits: number
  depositsBy: Record<string, number>
  /** Account shares moved out this year (a divorce split); not taxed, not part of cash flow. */
  splitOut: number
  /** Taxable earned income after pre-tax contributions, plus traditional withdrawals and realized gains. */
  taxableIncome: number
  expenses: number
  expensesBy: Record<string, number>
  /** Spending as planned (patterns and spending changes), before any spending rule. */
  plannedSpending: number
  /** The spending rule's factor on planned flexible spending this year (1 = as planned, or no rule). */
  spendingFactor: number
  debtPayments: number
  /** Loan payments by debt id; principal is payment minus interest. */
  debtPaymentsBy: Record<string, number>
  /** The interest part of `debtPayments`. */
  debtInterest: number
  debtInterestBy: Record<string, number>
  /** Rent left after rented homes' costs, interest and depreciation: taxed as ordinary income. */
  rentalTaxable: number
  /** Federal deduction taken (brackets only): the standard deduction, or itemized when larger. */
  deduction: { amount: number; itemized: boolean; senior?: number } | null
  assetPurchases: number
  assetSales: number
  /** Cash drawn this year from loans that start during the plan and don't pay for a purchase (a HELOC). */
  borrowed: number
  /** Everything deposited into accounts: your payroll contributions, employer match and leftover cash flow. */
  contributions: number
  contributionsBy: Record<string, number>
  withdrawals: number
  withdrawalsBy: Record<string, number>
  /** Required minimum distributions (included in `withdrawals`): from traditional accounts once the owner reaches 73 / 75. */
  requiredWithdrawals: number
  requiredBy: Record<string, number>
  /** Moved from traditional accounts to Roth (gross, ordinary income); not part of `withdrawals` or `contributions`. */
  conversions: number
  /** Converted by source (traditional) account. */
  conversionsBy: Record<string, number>
  /** Reaching each Roth account (less any tax withheld). */
  conversionsInto: Record<string, number>
  /** The tax the conversions add (already inside `incomeTax` / `withdrawalTax`; shown for reference). */
  conversionTax: number
  /** Leftover cash flow deposited per account by the cash-flow rules (buffer top-up included). */
  surplusBy: Record<string, number>
  /** Withdrawals per account made to cover a shortfall (not earmarked 529 draws). */
  shortfallBy: Record<string, number>
  growth: number
  /** Value gained / lost this year by assets held all year (depreciation is positive). */
  assetAppreciation: number
  assetDepreciation: number
  balances: Record<string, number>
  assetValues: Record<string, number>
  debtBalances: Record<string, number>
  accountsTotal: number
  assetsTotal: number
  debtsTotal: number
  netWorth: number
  /** Accounts minus debts; comparable to real net-worth history, which has no home values. */
  financialNetWorth: number
  /** Spending the accounts could not cover. */
  shortfall: number
  milestones: string[]
}

/** A backup plan the simulation used: the home sold the year the money would have run out. */
export interface HomeSale {
  assetId: string
  name: string
  /** Plan year index of the sale. */
  index: number
  year: number
  /** What came after: the backup plan's rent or smaller home, or the plan's own sale brought forward. */
  then: Exclude<HomeFallback["then"], "keep"> | "asPlanned"
  /** A planned sale brought forward: the year the plan had it. */
  plannedYear?: number
}

export interface PlanProjection {
  rows: YearRow[]
  /** Homes sold by their backup plan, in the order they were needed. */
  homeSales?: HomeSale[]
  /** Balances at plan start, before the first year. */
  startNetWorth: number
  startFinancialNetWorth: number
}

export interface PlanSummary {
  retirementYear: number | null
  retirementAge: number | null
  /** Today's dollars. */
  netWorthAtRetirement: number | null
  /** When the cash runs out: the accounts can't pay a year's bills. */
  depletedAge: number | null
  depletedYear: number | null
  /** When the plan goes broke: at or after the cash runs out, net worth below a year of spending (null: never). */
  brokeAge: number | null
  brokeYear: number | null
  /** Net worth split into money in the accounts and everything else (homes and other property, less their loans and
   *  other debts), today's dollars. */
  retirementSplit: { accounts: number; property: number } | null
  endingSplit: { accounts: number; property: number }
  /** When the money runs out: home equity left (today's dollars) and how many years of that year's spending it is. */
  equityAtDepletion?: { value: number; years: number } | null
  /** Homes sold by their backup plan when the money would have run out. */
  homeSales?: { name: string; year: number; age: number }[]
  endYear: number
  endAge: number
  /** Today's dollars. */
  endingNetWorth: number
  /** Today's dollars. */
  lifetimeTaxes: number
  /**
   * Ending net worth less the tax heirs would owe on the traditional (pre-tax) balances left, at the plan's heirs' tax
   * rate; today's dollars. What the Roth optimizer maximizes.
   */
  afterTaxEndingNetWorth: number
  /** Roth conversions and required withdrawals over the plan, today's dollars. */
  lifetimeConversions: number
  lifetimeRequired: number
  /** Net worth per year in today's dollars, for sparklines. */
  spark: number[]
  /** The inflation the plan uses (a market path's equivalent single rate) and where it comes from. */
  inflation?: number
  inflationMode?: "custom" | "market" | "marketPath"
}

export type DollarBasis = "today" | "future"
