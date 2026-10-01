import { ageAtStart, isActive, resolveRange, type ResolvedRange, type TimingContext } from "../plan-timing"
import { priceIndex, type Inflation } from "../plan-inflation"
import { ASSET_COSTS_CATEGORY } from "../plan-asset-costs"
import { patternFactor, retirementAge } from "../plan-spending-patterns"
import type { PlanAccount, PlanExpense, PlanIncome } from "../plan-types"

export interface IncomeEntry {
  income: PlanIncome
  range: ResolvedRange
}

export interface ExpenseEntry {
  expense: PlanExpense
  range: ResolvedRange
  /** Share of today's amount in year `index` from the line's spending pattern (1 = steady). */
  pattern: (index: number) => number
}

export function incomeEntries(incomes: PlanIncome[], ctx: TimingContext): IncomeEntry[] {
  return incomes.map((income) => ({ income, range: resolveRange(income.start, income.end, ctx) }))
}

export function expenseEntries(expenses: PlanExpense[], ctx: TimingContext): ExpenseEntry[] {
  const person = ctx.doc.people[0]
  const age0 = person ? ageAtStart(person, ctx.doc.settings) : 0
  const retireAge = retirementAge(ctx.doc)
  return expenses.map((expense) => ({
    expense,
    range: resolveRange(expense.start, expense.end, ctx),
    pattern: (index: number) => (expense.oneTime ? 1 : patternFactor(expense.pattern, age0 + index, retireAge, age0)),
  }))
}

/** Nominal amount in year `index` for a today's-dollars amount growing at `growth` (null = inflation). */
export function grown(amount: number, growth: number | null, inflation: Inflation, index: number): number {
  return amount * (growth === null ? priceIndex(inflation, index) : Math.pow(1 + growth, index))
}

export interface IncomeYear {
  total: number
  byId: Record<string, number>
  /** Taxable income after pre-tax payroll contributions. */
  taxableIncome: number
  /** Employee payroll contributions (they leave take-home pay). */
  employeeContributions: number
  employerMatch: number
  /** Employer match per account. */
  matchBy: Record<string, number>
  /** Payroll deposits per account, employee and employer combined. */
  deposits: Record<string, number>
}

function addTo(record: Record<string, number>, key: string, amount: number): Record<string, number> {
  return { ...record, [key]: (record[key] ?? 0) + amount }
}

/** Income, payroll contributions and employer match for year `index`. */
export function incomeForYear(
  entries: IncomeEntry[],
  accounts: PlanAccount[],
  index: number,
  inflation: Inflation,
): IncomeYear {
  const accountIds = new Set(accounts.map((a) => a.id))
  let result: IncomeYear = {
    total: 0,
    byId: {},
    taxableIncome: 0,
    employeeContributions: 0,
    employerMatch: 0,
    matchBy: {},
    deposits: {},
  }
  for (const { income, range } of entries) {
    if (!isActive(range, index, income.oneTime)) continue
    const gross = grown(income.amount, income.growth, inflation, index)
    let taxable = income.taxable ? gross : 0
    let deposits = result.deposits
    let matchBy = result.matchBy
    let employee = 0
    let match = 0
    for (const c of income.contributions) {
      if (!accountIds.has(c.accountId)) continue
      const own = gross * c.percent
      const employer = gross * c.employerMatchPercent
      if (c.preTax && income.taxable) taxable -= own
      employee += own
      match += employer
      deposits = addTo(deposits, c.accountId, own + employer)
      if (employer > 0) matchBy = addTo(matchBy, c.accountId, employer)
    }
    result = {
      total: result.total + gross,
      byId: { ...result.byId, [income.id]: gross },
      taxableIncome: result.taxableIncome + Math.max(0, taxable),
      employeeContributions: result.employeeContributions + employee,
      employerMatch: result.employerMatch + match,
      matchBy,
      deposits,
    }
  }
  return result
}

export interface ExpenseYear {
  total: number
  byId: Record<string, number>
}

/** Generated costs that spending-level changes (moving, etc.) don't scale: kids, and owning a home or car. */
const FIXED_CATEGORIES = new Set(["Kids", ASSET_COSTS_CATEGORY])

export function expensesForYear(entries: ExpenseEntry[], index: number, inflation: Inflation, spendingFactor = 1): ExpenseYear {
  return entries.reduce<ExpenseYear>(
    (acc, { expense, range, pattern }) => {
      if (!isActive(range, index, expense.oneTime)) return acc
      const factor = (expense.category !== null && FIXED_CATEGORIES.has(expense.category)) || expense.oneTime ? 1 : spendingFactor
      const amount = grown(expense.amount, expense.growth, inflation, index) * factor * pattern(index)
      return { total: acc.total + amount, byId: { ...acc.byId, [expense.id]: amount } }
    },
    { total: 0, byId: {} },
  )
}
