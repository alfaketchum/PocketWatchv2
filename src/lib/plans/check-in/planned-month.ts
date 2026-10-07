import { planPath, valueAt } from "../plan-progress"
import type { PlanDocument, PlanProjection } from "../plan-types"
import type { YearRow } from "../plan-row-types"

/** Plan spending with no category, and the engine's generated lines (child costs, asset running costs). */
export const OTHER_PLANNED_CATEGORY = "Other planned"
/** The plan's loan payments: real ones show up as spending (a mortgage under Housing). */
export const LOAN_PAYMENTS_CATEGORY = "Loan payments"

/** What the plan expects for one calendar month. Flows are a twelfth of the plan year holding the month. */
export interface PlannedMonth {
  /** Financial net worth at month end; null before the plan starts. */
  netWorth: number | null
  /** Take-home pay: gross − payroll contributions − income and payroll tax. */
  income: number
  spending: number
  byCategory: Record<string, number>
  /** One-time spending in that plan year, whole (kept out of the monthly figures, like one-time income). */
  oneTime: number
}

const round = (n: number) => Math.round(n * 100) / 100

/** Plan year index holding the month; months before the plan starts use its first year. */
export function planYearIndex(doc: PlanDocument, year: number, month: number): number {
  const offset = year * 12 + month - 1 - (doc.settings.startYear * 12 + doc.settings.startMonth - 1)
  return Math.max(0, Math.floor(offset / 12))
}

function monthlyTakeHome(doc: PlanDocument, row: YearRow): number {
  const accountIds = new Set(doc.accounts.map((a) => a.id))
  let recurring = 0
  let recurringOwn = 0
  for (const inc of doc.incomes) {
    if (inc.oneTime) continue
    const gross = row.incomeBy[inc.id] ?? 0
    const share = inc.contributions.filter((c) => accountIds.has(c.accountId)).reduce((sum, c) => sum + c.percent, 0)
    recurring += gross
    recurringOwn += gross * share
  }
  // Taxes fall on the recurring part in proportion to its share of gross pay.
  const taxShare = row.income > 0 ? recurring / row.income : 0
  const net = recurring - recurringOwn - (row.incomeTax + row.payrollTax) * taxShare
  return net / 12
}

function spendingByCategory(doc: PlanDocument, row: YearRow): { byCategory: Record<string, number>; oneTime: number } {
  const lines = new Map(doc.expenses.map((e) => [e.id, e]))
  const byCategory: Record<string, number> = {}
  let oneTime = 0
  for (const [id, amount] of Object.entries(row.expensesBy)) {
    const line = lines.get(id)
    if (line?.oneTime) {
      oneTime += amount
      continue
    }
    const category = line?.category || OTHER_PLANNED_CATEGORY
    byCategory[category] = (byCategory[category] ?? 0) + amount / 12
  }
  if (row.debtPayments > 0) byCategory[LOAN_PAYMENTS_CATEGORY] = row.debtPayments / 12
  return { byCategory, oneTime }
}

/** The plan's expectations for a calendar month (month 1–12); null when the plan has no rows. */
export function plannedForMonth(doc: PlanDocument, projection: PlanProjection, year: number, month: number): PlannedMonth | null {
  const row = projection.rows[planYearIndex(doc, year, month)]
  if (!row) return null
  const spending = spendingByCategory(doc, row)
  const byCategory = Object.fromEntries(Object.entries(spending.byCategory).map(([k, v]) => [k, round(v)]))
  const netWorth = valueAt(planPath(doc, projection), year + month / 12)
  return {
    netWorth: netWorth === null ? null : round(netWorth),
    income: round(monthlyTakeHome(doc, row)),
    spending: round(Object.values(spending.byCategory).reduce((a, b) => a + b, 0)),
    byCategory,
    oneTime: round(spending.oneTime),
  }
}
