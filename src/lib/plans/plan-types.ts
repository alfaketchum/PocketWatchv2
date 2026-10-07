/** Tax bucket of an account; decides how contributions and withdrawals are taxed. */
export type TaxTreatment = "cash" | "taxable" | "traditional" | "roth" | "hsa" | "education"

export type IncomeKind = "salary" | "business" | "equity" | "social_security" | "pension" | "rental" | "other"

export type AssetKind = "home" | "vehicle" | "other"

export type DebtKind = "mortgage" | "heloc" | "student" | "auto" | "credit" | "other"

export type MilestoneKind = "retirement" | "custom" | "child" | "asset" | "income"

/** When something starts or ends. Ranges are [start, end): an item ending at a milestone stops that year. */
export type Timing =
  | { type: "planStart" }
  | { type: "planEnd" }
  | { type: "year"; year: number }
  | { type: "age"; personId: string; age: number }
  /** At a milestone, or `offsetYears` after it (so a 3-year break's end moves with its start). */
  | { type: "milestone"; milestoneId: string; offsetYears?: number }

/** Link back to the real account an item was imported from; only used by "Refresh balances". */
export interface PlanSource {
  kind: "finance-account" | "crypto" | "real-asset"
  refId: string
}

export interface PlanPerson {
  id: string
  name: string
  birthYear: number
  /** 1–12. */
  birthMonth: number
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

/**
 * A spending rule: from retirement, flexible spending (not kids, home & vehicle costs or one-time items) follows the
 * portfolio. Rates and bounds are fractions; floor / ceiling are shares of the planned spending (null = none).
 */
export type SpendingRule =
  | { kind: "guardrails"; band: number; step: number }
  | { kind: "percent"; rate: number; floor: number | null; ceiling: number | null }
  | { kind: "cape"; a: number; b: number; floor: number | null; ceiling: number | null }

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
  /** "brackets": 2026 federal + state brackets, indexed to inflation. "flat": the flat rates above. */
  taxMode: "flat" | "brackets"
  /** Two-letter state of residence for state income tax; null for none. */
  state: string | null
  filingStatus: "single" | "joint"
  /** The spending profile last applied to every line; new lines follow it. Missing = none picked. */
  spendingProfile?: PatternProfile
  /** How flexible spending responds to the portfolio from retirement; unset = spend as planned. */
  spendingRule?: SpendingRule
  /**
   * Where `inflation` comes from. custom (default): your number. market: the TIPS breakeven matching the
   * plan's length. marketPath: a different rate each year from the breakeven curve (`inflation` then holds
   * the equivalent single rate, for display).
   */
  inflationMode?: "custom" | "market" | "marketPath"
  /** The market's breakeven inflation when it was last applied. */
  marketInflation?: MarketInflation
  /**
   * How account returns are shown and entered: before inflation (nominal, default) or after it (real). Stored
   * returns are always nominal; with "real", changing inflation moves them so real returns stay the same.
   */
  returnBasis?: "nominal" | "real"
  /** Social Security paid at a share of scheduled benefits from a year on (a trust fund shortfall); missing = in full. */
  ssCut?: { share: number; fromYear: number }
  /** Credit score at plan start: prices loans the plan hasn't fixed, and is projected year by year. */
  credit?: PlanCredit
}

export interface PlanCredit {
  score: number
  /** When it was checked, YYYY-MM-DD. */
  asOf: string
  /** Total credit-card limits then, for utilization on card debt; missing = not counted. */
  cardLimit?: number
}

/** Inflation the bond market expects (Treasury minus TIPS yields), FRED data. Rates are decimals. */
export interface MarketInflation {
  /** Date of the data, YYYY-MM-DD. */
  asOf: string
  /** 5-year breakeven; the 5 years after that (5y5y forward); 10-, 20- and 30-year breakevens. */
  y5: number
  y5y5: number
  y10: number
  y20: number
  y30: number
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
  /** Inherited retirement accounts must be emptied by the end of this year (10-year rule); drawn evenly. */
  drainByYear?: number | null
  /** Taxable accounts: share of gains from holdings kept a year or less (taxed as ordinary income). */
  shortTermShare?: number
  /** Taxable accounts: share of each year's growth sold that year (active trading), taxed yearly. */
  realizedShare?: number
  /** Stress test: what the account holds (shares add up to 1); unset uses `defaultMix`. */
  mix?: AccountMix
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

/** Shares of an account in each asset class, for replaying market history. */
export interface AccountMix {
  stocks: number
  bonds: number
  cash: number
  crypto: number
}

/**
 * Equity pay valued from the stock: RSUs vest `shares` a year; options pay `shares` × (price − strike) when
 * exercised. The price grows at the income's growth (the stress test replays it with the market instead).
 */
export interface EquityGrant {
  /** Ticker for looking up today's price; null when entered by hand (private company). */
  symbol: string | null
  /** RSUs: shares granted (with `vesting`), or vesting each year (without); options: shares held. */
  shares: number
  /** Price per share today. */
  price: number
  /** Options only: what you pay per share. */
  strike?: number
  /** Options only: the stock's yearly volatility, for the expected gain (outcomes above the strike count). */
  volatility?: number
  /**
   * Options only: incentive stock options. Shares kept aren't taxed at exercise (the gain counts toward the AMT) and
   * the whole gain is a long-term gain when sold; shares sold right away are ordinary income, not wages.
   */
  iso?: boolean
  /** RSUs: how the grant vests from the income's start; leaving (the income's stop) forfeits what hasn't. */
  vesting?: VestingSchedule
}

/** An RSU grant's vesting: each year's share, the cliff, how often, and optional yearly refreshers. */
export interface VestingSchedule {
  /** Share of the grant vesting in each year after it's made (adds up to 1). */
  yearly: number[]
  /** Nothing vests until this many months after the grant; what would have vests then. */
  cliffMonths: number
  /** Months between vests after the cliff (1, 3, 6 or 12). */
  every: number
  /** Month of the year the grant was made (1–12). */
  grantMonth: number
  /** A new grant of the same value (today's dollars) every year while you're there, vesting the same way. */
  refresh: boolean
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
  /** ESPP: the purchase discount (0.15 = shares bought at 85% of price); the gain is taxed as income. */
  discount?: number
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
  /** Equity pay (kind "equity") valued from shares and the stock price; `amount` then shows today's value. */
  equity?: EquityGrant
  /** Whose income it is (a person's id); missing = the plan's first person. */
  personId?: string
  /**
   * Social Security worked out by the engine each year: the benefit at full retirement age (per month, today's
   * dollars) and the claiming age. Adds the spousal top-up and the earnings test; `amount` is then only a display.
   */
  socialSecurity?: {
    pia: number
    claimAge: number
    /**
     * Estimate the PIA from earnings instead: past years [year, amount in that year's dollars] (an SSA earnings
     * record); years from the plan's start come from this person's salaries in the plan. `pia` then holds the
     * last estimate, for display.
     */
    earnings?: [number, number][]
  }
  /** Set on an income that picks up where another left off (career change/break); removing it restores that one's end. */
  continues?: string
  /** Set when a milestone (divorce) ended this income early: the end to restore if that milestone is deleted. */
  endBefore?: Timing
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

/**
 * How spending changes over time, on top of inflation: steady, go-go (more for 10 years, then less),
 * tapering (a little less each year), rising (faster than inflation, e.g. healthcare) or custom phases.
 */
export type PatternPreset = "steady" | "gogo" | "tapering" | "rising" | "custom"

/** Sets of patterns applied to every spending line at once. */
export type PatternProfile = "typical" | "frontload" | "conservative" | "frugal" | "reset"

export interface SpendingStage {
  preset: PatternPreset
  /** Custom only: from each age on, spend this share of today's amount (1 = 100%). */
  phases?: { fromAge: number; factor: number }[]
}

/** A line's pattern from now, and optionally a second one from retirement or a chosen age. */
export interface SpendingPattern extends SpendingStage {
  then?: SpendingStage & { at: "retirement" | "age"; age?: number }
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
  /** How it changes with age; missing = steady. */
  pattern?: SpendingPattern
  /**
   * Generated only: a running cost of this asset (property tax flagged for SALT / rental expenses). A cost set
   * as a share of value has `realGrowth`: it rises with inflation plus the asset's real appreciation, following
   * the value on any inflation path (`growth` then only describes it).
   */
  costOf?: { assetId: string; propertyTax: boolean; realGrowth?: number }
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

/** How a purchase is paid: cash in full, a loan on the terms given, or not decided yet (typical terms). */
export type PaymentMode = "cash" | "loan" | "undecided"

export interface AssetFinancing {
  mode: PaymentMode
  /** Share of the price paid up front. */
  downShare: number
  /** Annual loan rate. */
  rate: number
  termYears: number
  /** Extra principal paid each month, today's dollars (the loan's first-year dollars once bought). */
  extraMonthly?: number
}

/** A yearly cost of owning an asset: dollars a year (today's, rising with inflation) or a share of its value. */
export interface AssetRunningCost {
  name: string
  amount: number
  basis: "dollars" | "percentOfValue"
  /** Property tax counts toward SALT when itemizing (older plans: recognized by name). */
  kind?: "propertyTax"
}

/** Renting a home out: rent and its costs, in today's dollars. */
export interface AssetRental {
  monthlyRent: number
  /** When renting starts; null = as soon as it's owned. */
  start: Timing | null
  /** Share of the year it sits empty. */
  vacancy: number
  /** Property manager's cut of the rent collected. */
  managementFee: number
  /** Yearly rent increase; null = inflation. */
  growth: number | null
}

export interface PlanAsset {
  id: string
  name: string
  kind: AssetKind
  /** Value today; a future start buys it at this value grown by `appreciation`. */
  value: number
  appreciation: number
  /**
   * Vehicles: the car's age in years when it enters the plan (bought, or today if already owned). When set, it
   * loses value along the typical depreciation curve for its age instead of the flat `appreciation`.
   */
  vehicleAge?: number
  start: Timing
  /** Sold in this year; proceeds after linked debts flow back in. */
  end: Timing
  /** "received" (inherited or gifted) assets cost nothing when they arrive. Defaults to purchase. */
  acquired?: "purchase" | "received"
  /** For capital-gains tax on sale; null = value when acquired (purchase price, or stepped-up value). */
  costBasis?: number | null
  /** The home or vehicle on Finance › Homes & Vehicles this came from, for "Refresh balances". */
  source?: PlanSource | null
  /** How a future purchase is paid. Missing = cash, unless a debt is linked to it. A linked debt always wins. */
  financing?: AssetFinancing
  /** Insurance, maintenance, property tax…: charged every year it's owned. */
  runningCosts?: AssetRunningCost[]
  /** Sell it and buy another like it every this many years (a car), until it's sold. Null or missing = keep it. */
  replaceEveryYears?: number | null
  /** Homes: you live in it, so its sale can use the home-sale exclusion and its property tax and mortgage
   *  interest can be itemized. Missing = yes for a home you buy, no for one you inherit. */
  primaryResidence?: boolean
  /** Homes: rented out (then it isn't your residence; its costs count against the rent). */
  rental?: AssetRental
  /** Homes: a backup plan if the money in your accounts runs out (off when missing). */
  fallback?: HomeFallback
  /** Generated only: the asset this one replaces (a later car in a replacement cycle). */
  replacementOf?: string
  /** Generated only: sold because a replacement takes over, not sold outright. */
  replaced?: boolean
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

/** A home equity line: interest-only while you can draw on it, then paid down like a mortgage. */
export interface HelocTerms {
  /** Years of the draw period left from the debt's start; only interest is due. */
  drawYears: number
  /** Years to repay the balance once the draw period ends. */
  repayYears: number
  /** Spent buying, building or improving the home it's against: only then is its interest deductible. */
  forHome: boolean
}

export interface PlanDebt {
  id: string
  name: string
  kind: DebtKind
  /** Balance when the debt starts. */
  balance: number
  /** Annual interest rate. */
  rate: number
  /** Ignored for a HELOC: its payment follows `heloc`. */
  monthlyPayment: number
  /** Extra principal paid each month on top of the payment, until it's paid off. */
  extraMonthly?: number
  start: Timing
  /** Only for kind "heloc". */
  heloc?: HelocTerms
  /** The asset this debt finances; it is paid off when the asset is sold. */
  assetId: string | null
  source: PlanSource | null
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

export interface SurplusTarget {
  accountId: string
  /** Most added per year in today's dollars; null means no cap. */
  annualCap: number | null
}

export interface PlanCashFlow {
  surplusOrder: SurplusTarget[]
  withdrawalOrder: string[]
  /** Before 59½, draw penalized accounts (traditional 401k/IRA) last; unset = on. */
  avoidEarlyPenalty?: boolean
}

export interface PlanMilestone {
  id: string
  name: string
  kind: MilestoneKind
  timing: Timing
  /** Material Symbols icon for generated milestones (children). */
  icon?: string
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
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

/** Money that lands straight in an account, outside your cash flow (inherited stocks, a gift). */
export interface PlanDeposit {
  id: string
  name: string
  accountId: string
  /** Today's dollars. */
  amount: number
  /**
   * Instead of `amount`: this share (0–1) of the account's balance at the time moves out, untaxed and outside
   * cash flow (a divorce split; transfers between spouses in a divorce aren't taxed).
   */
  share?: number
  timing: Timing
  /** The milestone that created this (templates); deleting that milestone can remove it too. */
  origin?: string
}

/** A change that applies from a point in time onward (the latest one in effect wins). */
export type PlanAdjustment =
  | { id: string; kind: "taxRates"; timing: Timing; incomeTaxRate: number; capitalGainsRate: number; origin?: string }
  | {
      id: string
      kind: "spending"
      timing: Timing
      /** Your own expenses change by this share from then on (−0.2 = 20% less). Kids' costs are unaffected. */
      percent: number
      origin?: string
    }
  | { id: string; kind: "filingStatus"; timing: Timing; status: "single" | "joint"; origin?: string }
  /** Where you live from then on (state tax under brackets); null = no state income tax. */
  | { id: string; kind: "state"; timing: Timing; state: string | null; origin?: string }

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
  adjustments: PlanAdjustment[]
  deposits: PlanDeposit[]
  /** Linked accounts (finance account ids) the user chose not to bring into this plan. */
  ignoredSources?: string[]
}

/** If the accounts run dry, sell this home that year, then rent or buy a smaller one (today's dollars). */
export interface HomeFallback {
  /**
   * After the sale: rent, buy a smaller home with cash, or nothing (a second home or a rental). "keep" never sells it,
   * and is stored so a deliberate Keep isn't replaced by the default (a home you live in sells and rents).
   */
  then: "keep" | "rent" | "smaller" | "sell"
  monthlyRent: number
  price: number
}

// Simulation results live in plan-row-types.ts; re-exported so imports stay "./plan-types".
export type { DollarBasis, HomeSale, PlanProjection, PlanSummary, YearRow } from "./plan-row-types"
