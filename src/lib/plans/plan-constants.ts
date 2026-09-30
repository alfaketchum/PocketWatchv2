import type { PlanDocument, TaxTreatment } from "./plan-types"

export const MAX_PLANS_PER_USER = 25
export const MAX_PLAN_YEARS = 100
export const PLAN_SCHEMA_VERSION = 1

export const PLAN_LIMITS = {
  people: 2,
  accounts: 50,
  incomes: 50,
  expenses: 100,
  assets: 30,
  debts: 30,
  milestones: 30,
  children: 10,
  adjustments: 30,
  deposits: 30,
  contributionsPerIncome: 10,
} as const

export const DEFAULT_RETURN_RATE = 0.07
export const DEFAULT_CASH_RETURN = 0.02
export const DEFAULT_RETIREMENT_AGE = 65
export const DEFAULT_PERSON_AGE = 35

/** Withdrawal order used for accounts missing from the plan's own order. */
export const DEFAULT_WITHDRAWAL_ORDER: TaxTreatment[] = ["cash", "taxable", "traditional", "hsa", "roth"]

/** Where surplus left after the plan's own order goes: the first account of the first matching treatment. */
export const SURPLUS_OVERFLOW_ORDER: TaxTreatment[] = ["taxable", "cash", "traditional", "roth", "hsa"]

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  cash: "Cash",
  taxable: "Taxable",
  traditional: "Traditional (pre-tax)",
  roth: "Roth",
  hsa: "HSA",
  education: "Education (529)",
}

export const RETIREMENT_MILESTONE_ID = "ms-retirement"
export const PRIMARY_PERSON_ID = "person-1"

/** A blank plan for someone of `age`, starting this month. */
export function blankPlanDocument(now: Date, age = DEFAULT_PERSON_AGE): PlanDocument {
  const startYear = now.getFullYear()
  const startMonth = now.getMonth() + 1
  return {
    settings: {
      startYear,
      startMonth,
      endAge: 95,
      inflation: 0.03,
      incomeTaxRate: 0.2,
      capitalGainsRate: 0.15,
      cashBuffer: 20_000,
      bufferAccountId: null,
      protectBuffer: true,
    },
    people: [{ id: PRIMARY_PERSON_ID, name: "Me", birthYear: startYear - age, birthMonth: 1 }],
    accounts: [
      {
        id: "acct-cash",
        name: "Cash",
        taxTreatment: "cash",
        balance: 0,
        costBasis: null,
        returnRate: DEFAULT_CASH_RETURN,
        owner: null,
        source: null,
      },
      {
        id: "acct-brokerage",
        name: "Brokerage",
        taxTreatment: "taxable",
        balance: 0,
        costBasis: null,
        returnRate: DEFAULT_RETURN_RATE,
        owner: null,
        source: null,
      },
    ],
    incomes: [],
    expenses: [],
    assets: [],
    debts: [],
    cashFlow: { surplusOrder: [], withdrawalOrder: [] },
    children: [],
    adjustments: [],
    deposits: [],
    milestones: [
      {
        id: RETIREMENT_MILESTONE_ID,
        name: "Retirement",
        kind: "retirement",
        timing: { type: "age", personId: PRIMARY_PERSON_ID, age: DEFAULT_RETIREMENT_AGE },
      },
    ],
  }
}
