/** Tax bucket of an account; decides how contributions and withdrawals are taxed. */
export type TaxTreatment = "cash" | "taxable" | "traditional" | "roth" | "hsa" | "education"

export type IncomeKind = "salary" | "business" | "social_security" | "pension" | "rental" | "other"

export type AssetKind = "home" | "vehicle" | "other"

export type DebtKind = "mortgage" | "student" | "auto" | "credit" | "other"

export type MilestoneKind = "retirement" | "custom" | "child" | "asset"

/** When something starts or ends. Ranges are [start, end): an item ending at a milestone stops that year. */
export type Timing =
  | { type: "planStart" }
  | { type: "planEnd" }
  | { type: "year"; year: number }
  | { type: "age"; personId: string; age: number }
  | { type: "milestone"; milestoneId: string }

/** Link back to the real account an item was imported from; only used by "Refresh balances". */
export interface PlanSource {
  kind: "finance-account" | "crypto"
  refId: string
}

export interface PlanPerson {
  id: string
  name: string
  birthYear: number
  /** 1–12. */
  birthMonth: number
}

export interface PlanSettings {
  startYear: number
  /** 1–12. */
  startMonth: number
  /** The plan runs until the first person reaches this age. */
  endAge: number
  inflation: number
  /** Flat effective rate on taxable income and on traditional-account withdrawals. */
  incomeTaxRate: number
  /** Applied to the gains share of taxable-account withdrawals. */
  capitalGainsRate: number
  /** Cash kept on hand (today's dollars) before surplus flows to investments. */
  cashBuffer: number
  /** Cash account holding the buffer; null uses the first cash account. */
  bufferAccountId: string | null
  /** When on, shortfalls leave the buffer alone until every other account is empty. */
  protectBuffer: boolean
}

export interface PlanAccount {
  id: string
  name: string
  taxTreatment: TaxTreatment
  /** Balance at plan start. */
  balance: number
  /** Taxable accounts only; null treats the whole balance as basis. */
  costBasis: number | null
  /** Nominal annual return. */
  returnRate: number
  owner: string | null
  source: PlanSource | null
}

/** Payroll contribution from an income stream into an account. */
export interface PlanContribution {
  id: string
  accountId: string
  /** Share of the income's gross amount the employee contributes. */
  percent: number
  /** Share of gross the employer adds on top. */
  employerMatchPercent: number
  /** Pre-tax contributions lower taxable income (traditional 401k, HSA). */
  preTax: boolean
}

export interface PlanIncome {
  id: string
  name: string
  kind: IncomeKind
  /** Annual amount in today's dollars. */
  amount: number
  /** Nominal annual growth; null follows inflation. */
  growth: number | null
  start: Timing
  end: Timing
  taxable: boolean
  /** Paid once, in the start year. */
  oneTime: boolean
  contributions: PlanContribution[]
}

export interface PlanExpense {
  id: string
  name: string
  category: string | null
  /** Annual amount in today's dollars. */
  amount: number
  /** Nominal annual growth; null follows inflation. */
  growth: number | null
  start: Timing
  end: Timing
  oneTime: boolean
  /** Paid from this account first (tax-free), e.g. college from a 529. Set on generated child expenses. */
  fundedBy?: string | null
}

export interface PlanAsset {
  id: string
  name: string
  kind: AssetKind
  /** Value today; a future start buys it at this value grown by `appreciation`. */
  value: number
  appreciation: number
  start: Timing
  /** Sold in this year; proceeds after linked debts flow back in. */
  end: Timing
}

export interface PlanDebt {
  id: string
  name: string
  kind: DebtKind
  /** Balance when the debt starts. */
  balance: number
  /** Annual interest rate. */
  rate: number
  monthlyPayment: number
  start: Timing
  /** The asset this debt finances; it is paid off when the asset is sold. */
  assetId: string | null
  source: PlanSource | null
}

export interface SurplusTarget {
  accountId: string
  /** Most added per year in today's dollars; null means no cap. */
  annualCap: number | null
}

export interface PlanCashFlow {
  surplusOrder: SurplusTarget[]
  withdrawalOrder: string[]
}

export interface PlanMilestone {
  id: string
  name: string
  kind: MilestoneKind
  timing: Timing
  /** Material Symbols icon for generated milestones (children). */
  icon?: string
}

export type CollegePreset = "public_in_state" | "public_out_of_state" | "private" | "custom"

/** A child and the costs, savings and milestones that come with them. */
export interface PlanChild {
  id: string
  name: string
  birthYear: number
  raising: { enabled: boolean; annualCost: number; untilAge: number }
  college: {
    enabled: boolean
    preset: CollegePreset
    /** Cost of attendance per year, today's dollars. */
    annualCost: number
    startAge: number
    years: number
    /** Nominal yearly growth of college costs (tuition outpaces inflation). */
    growth: number
  }
  plan529: {
    enabled: boolean
    /** The Education (529) account it saves into; created when the plan is turned on. */
    accountId: string | null
    /** Yearly contribution (today's dollars) from cash flow until college starts. */
    annualContribution: number
  }
  /** Help after college (or after raising costs end when there's no college). */
  support: { enabled: boolean; annualAmount: number; years: number }
}

export interface PlanDocument {
  settings: PlanSettings
  people: PlanPerson[]
  accounts: PlanAccount[]
  incomes: PlanIncome[]
  expenses: PlanExpense[]
  assets: PlanAsset[]
  debts: PlanDebt[]
  cashFlow: PlanCashFlow
  milestones: PlanMilestone[]
  children: PlanChild[]
}

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
  withdrawalTax: number
  /** Taxable earned income after pre-tax contributions, plus traditional withdrawals and realized gains. */
  taxableIncome: number
  expenses: number
  expensesBy: Record<string, number>
  debtPayments: number
  assetPurchases: number
  assetSales: number
  /** Everything deposited into accounts: your payroll contributions, employer match and leftover cash flow. */
  contributions: number
  contributionsBy: Record<string, number>
  withdrawals: number
  withdrawalsBy: Record<string, number>
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

export interface PlanProjection {
  rows: YearRow[]
  /** Balances at plan start, before the first year. */
  startNetWorth: number
  startFinancialNetWorth: number
}

export interface PlanSummary {
  retirementYear: number | null
  retirementAge: number | null
  /** Today's dollars. */
  netWorthAtRetirement: number | null
  depletedAge: number | null
  depletedYear: number | null
  endYear: number
  endAge: number
  /** Today's dollars. */
  endingNetWorth: number
  /** Today's dollars. */
  lifetimeTaxes: number
  /** Net worth per year in today's dollars, for sparklines. */
  spark: number[]
}

export type DollarBasis = "today" | "future"
