import { DEFAULT_RETURN_RATE } from "@/lib/plans/plan-constants"
import { DEFAULT_STOCK_VOLATILITY, equityValueToday } from "@/lib/plans/engine/engine-equity"
import type { EquityGrant, PlanAccount, PlanDocument, PlanIncome, Timing } from "@/lib/plans/plan-types"
import { newItemId } from "../plans-helpers"

export type EquityMode = "rsu" | "options" | "espp"

/** Account picker value that creates a new company-stock account on Add. */
export const NEW_STOCK_ACCOUNT = "new"

/** Typical RSU grant: vests over four years. */
const RSU_VEST_YEARS = 4
/** Company stock is all stock in the stress test. */
const ALL_STOCK = { stocks: 1, bonds: 0, cash: 0, crypto: 0 }
const ESPP_DEFAULT_PERCENT = 0.1
export const ESPP_DEFAULT_DISCOUNT = 0.15

export interface EquityDraft {
  company: string
  /** RSUs: shares vesting a year; options: shares, strike and volatility. */
  grant: EquityGrant
  /** How fast the stock price grows (nominal). */
  growth: number
  start: Timing
  end: Timing
  /** Share of the value kept as stock (the rest is sold, cash into the plan). */
  kept: number
  /** Account the shares go into, or `NEW_STOCK_ACCOUNT`. */
  target: string
  /** ESPP: the salary it's bought from, the share of pay, and the discount. */
  incomeId: string
  percent: number
  discount: number
}

/** Taxable accounts that can hold company stock. */
export function stockAccounts(doc: PlanDocument): PlanAccount[] {
  return doc.accounts.filter((a) => a.taxTreatment === "taxable")
}

/** Salaries an ESPP can be bought from. */
export function esppIncomes(doc: PlanDocument): PlanIncome[] {
  return doc.incomes.filter((i) => i.kind === "salary" && !i.oneTime)
}

export function initialEquityDraft(mode: EquityMode, doc: PlanDocument): EquityDraft {
  const year = doc.settings.startYear
  const existing = stockAccounts(doc).find((a) => /stock/i.test(a.name))
  return {
    company: "",
    grant:
      mode === "options"
        ? { symbol: null, shares: 1_000, price: 30, strike: 10, volatility: DEFAULT_STOCK_VOLATILITY }
        : { symbol: null, shares: 200, price: 200 },
    growth: DEFAULT_RETURN_RATE,
    start: mode === "options" ? { type: "year", year: year + 1 } : { type: "planStart" },
    end: { type: "year", year: year + RSU_VEST_YEARS },
    kept: mode === "espp" ? 1 : 0,
    target: existing?.id ?? NEW_STOCK_ACCOUNT,
    incomeId: esppIncomes(doc)[0]?.id ?? "",
    percent: ESPP_DEFAULT_PERCENT,
    discount: ESPP_DEFAULT_DISCOUNT,
  }
}

function stockAccountName(company: string): string {
  return company.trim() ? `${company.trim()} stock` : "Company stock"
}

/** The account shares go into, adding a new company-stock account when asked. */
function withStockAccount(doc: PlanDocument, d: EquityDraft): { doc: PlanDocument; accountId: string } {
  if (d.target !== NEW_STOCK_ACCOUNT) return { doc, accountId: d.target }
  const account: PlanAccount = {
    id: newItemId("acct"),
    name: stockAccountName(d.company || d.grant.symbol || ""),
    taxTreatment: "taxable",
    balance: 0,
    costBasis: null,
    returnRate: DEFAULT_RETURN_RATE,
    owner: null,
    source: null,
    mix: ALL_STOCK,
  }
  return { doc: { ...doc, accounts: [...doc.accounts, account] }, accountId: account.id }
}

function equityIncome(d: EquityDraft, mode: "rsu" | "options", accountId: string | null): PlanIncome {
  const label = mode === "rsu" ? "RSUs" : "stock options"
  const company = d.company.trim() || d.grant.symbol || ""
  return {
    id: newItemId("inc"),
    name: company ? `${company} ${label}` : mode === "rsu" ? "RSUs" : "Stock options",
    kind: "equity",
    amount: equityValueToday(d.grant),
    growth: d.growth,
    start: d.start,
    end: mode === "rsu" ? d.end : { type: "planEnd" },
    taxable: true,
    oneTime: mode === "options",
    contributions: accountId
      ? [{ id: newItemId("contrib"), accountId, percent: d.kept, employerMatchPercent: 0, preTax: false }]
      : [],
    equity: { ...d.grant, symbol: d.grant.symbol || null },
  }
}

/** Adds RSU vesting or an option exercise as equity pay, with any kept shares going into a stock account. */
export function applyEquity(mode: EquityMode, d: EquityDraft, doc: PlanDocument): PlanDocument {
  if (mode === "espp") return applyEspp(d, doc)
  if (d.kept <= 0) return { ...doc, incomes: [...doc.incomes, equityIncome(d, mode, null)] }
  const placed = withStockAccount(doc, d)
  return { ...placed.doc, incomes: [...placed.doc.incomes, equityIncome(d, mode, placed.accountId)] }
}

function applyEspp(d: EquityDraft, doc: PlanDocument): PlanDocument {
  const placed = withStockAccount(doc, d)
  const contribution = { id: newItemId("contrib"), accountId: placed.accountId, percent: d.percent, employerMatchPercent: 0, preTax: false, discount: d.discount }
  return {
    ...placed.doc,
    incomes: placed.doc.incomes.map((i) => (i.id === d.incomeId ? { ...i, contributions: [...i.contributions, contribution] } : i)),
  }
}
