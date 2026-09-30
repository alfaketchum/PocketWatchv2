import { DEFAULT_CASH_RETURN, DEFAULT_RETURN_RATE, RETIREMENT_MILESTONE_ID } from "../plan-constants"
import type { DebtKind, PlanAccount, PlanDebt, PlanExpense, PlanIncome, TaxTreatment } from "../plan-types"

const MONTHS = 12
/** Categories averaging less than this per month are folded into "Other spending". */
export const MIN_CATEGORY_MONTHLY = 25
/** Credit-card payment when no minimum is known: pay the balance off over a year. */
const CARD_PAYOFF_MONTHS = 12
const DEFAULT_CARD_APR = 0.22
const DEFAULT_LOAN_MONTHS = 60

const CASH_TYPES = new Set(["checking", "savings", "business_checking", "business_savings", "depository", "cash"])
const DEBT_TYPES = new Set(["credit", "business_credit", "loan", "mortgage"])
const TRADITIONAL_SUBTYPES = [
  "401k", "401a", "403b", "457b", "ira", "sep", "simple", "keogh", "thrift savings", "tsp", "pension", "annuity",
  "retirement", "profit sharing",
]

export interface ImportAccountRow {
  id: string
  name: string
  institution: string
  type: string
  subtype: string | null
  currentBalance: number | null
  apy: number | null
}

export interface ImportLiability {
  accountId: string
  /** Annual rate as a fraction. */
  rate: number | null
  monthlyPayment: number | null
}

/** Tax bucket for a linked account, from its normalized type and raw subtype. Null for debts and unknowns. */
export function taxTreatmentFor(type: string, subtype: string | null): TaxTreatment | null {
  if (CASH_TYPES.has(type)) return "cash"
  if (type !== "investment" && type !== "brokerage") return null
  const sub = (subtype ?? "").toLowerCase().replace(/[()]/g, "")
  if (sub.includes("roth")) return "roth"
  if (sub.includes("hsa") || sub.includes("health savings")) return "hsa"
  if (TRADITIONAL_SUBTYPES.some((s) => sub.includes(s))) return "traditional"
  return "taxable"
}

export function accountsFromRows(rows: ImportAccountRow[]): PlanAccount[] {
  return rows.flatMap((row) => {
    const taxTreatment = taxTreatmentFor(row.type, row.subtype)
    const balance = row.currentBalance ?? 0
    if (!taxTreatment || balance <= 0) return []
    // FinanceAccount.apy is a fraction (yield accrual uses balance × apy / 365).
    const apy = row.apy && row.apy > 0 && row.apy < 1 ? row.apy : null
    return [
      {
        id: `acct-${row.id}`,
        name: `${row.name} (${row.institution})`,
        taxTreatment,
        balance,
        costBasis: null,
        returnRate: taxTreatment === "cash" ? (apy ?? DEFAULT_CASH_RETURN) : DEFAULT_RETURN_RATE,
        owner: null,
        source: { kind: "finance-account" as const, refId: row.id },
      },
    ]
  })
}

function debtKindFor(type: string, subtype: string | null): DebtKind {
  const sub = (subtype ?? "").toLowerCase()
  if (type === "mortgage" || sub.includes("mortgage")) return "mortgage"
  if (type === "credit" || type === "business_credit") return "credit"
  if (sub.includes("student")) return "student"
  if (sub.includes("auto")) return "auto"
  return "other"
}

function defaultPayment(kind: DebtKind, balance: number): number {
  return Math.ceil(balance / (kind === "credit" ? CARD_PAYOFF_MONTHS : DEFAULT_LOAN_MONTHS))
}

export function debtsFromRows(rows: ImportAccountRow[], liabilities: ImportLiability[]): PlanDebt[] {
  const byAccount = new Map(liabilities.map((l) => [l.accountId, l]))
  return rows.flatMap((row) => {
    if (!DEBT_TYPES.has(row.type)) return []
    const balance = Math.abs(row.currentBalance ?? 0)
    if (balance <= 0) return []
    const kind = debtKindFor(row.type, row.subtype)
    const liability = byAccount.get(row.id)
    const rate = Math.round((liability?.rate ?? (kind === "credit" ? DEFAULT_CARD_APR : 0)) * 1e4) / 1e4
    return [
      {
        id: `debt-${row.id}`,
        name: `${row.name} (${row.institution})`,
        kind,
        balance,
        rate,
        monthlyPayment: Math.ceil(Math.max(liability?.monthlyPayment ?? 0, defaultPayment(kind, balance))),
        start: { type: "planStart" as const },
        assetId: null,
        source: { kind: "finance-account" as const, refId: row.id },
      },
    ]
  })
}

export function cryptoAccount(value: number): PlanAccount | null {
  if (value <= 0) return null
  return {
    id: "acct-crypto",
    name: "Crypto",
    taxTreatment: "taxable",
    balance: value,
    costBasis: null,
    returnRate: DEFAULT_RETURN_RATE,
    owner: null,
    source: { kind: "crypto", refId: "crypto" },
  }
}

export function incomeFromMonthly(monthly: number): PlanIncome | null {
  if (monthly <= 0) return null
  return {
    id: "inc-imported",
    name: "Income",
    kind: "salary",
    amount: Math.round(monthly * MONTHS),
    growth: null,
    start: { type: "planStart" },
    end: { type: "milestone", milestoneId: RETIREMENT_MILESTONE_ID },
    taxable: true,
    oneTime: false,
    contributions: [],
  }
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "other"
}

/** One stream per spending category; small categories fold into "Other spending". */
export function expensesFromCategories(categories: { category: string; avgMonthly: number }[]): PlanExpense[] {
  const stream = (id: string, name: string, category: string | null, monthly: number): PlanExpense => ({
    id,
    name,
    category,
    amount: Math.round(monthly * MONTHS),
    growth: null,
    start: { type: "planStart" },
    end: { type: "planEnd" },
    oneTime: false,
  })
  const large = categories.filter((c) => c.avgMonthly >= MIN_CATEGORY_MONTHLY)
  const other = categories.filter((c) => c.avgMonthly > 0 && c.avgMonthly < MIN_CATEGORY_MONTHLY)
  const otherMonthly = other.reduce((s, c) => s + c.avgMonthly, 0)
  return [
    ...large.map((c, i) => stream(`exp-${i}-${slug(c.category)}`, c.category, c.category, c.avgMonthly)),
    ...(otherMonthly > 0 ? [stream("exp-other", "Other spending", null, otherMonthly)] : []),
  ]
}
