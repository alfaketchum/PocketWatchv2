import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { monthlyCashflow, type MonthCashflow } from "@/lib/finance/monthly-cashflow"
import { simulatePlan } from "../engine/simulate"
import { readPlanDocument } from "../plan-records"
import { actualFinancialNetWorth } from "./actual-net-worth"
import { plannedForMonth } from "./planned-month"

/** Kept out of actual spending: take-home pay is already after withholding, and the plan has no tax line. */
const NOT_PLAN_SPENDING = new Set(["Taxes"])

export type CheckInSource = "live" | "backfill"
export type CheckInResult = "created" | "updated" | "skipped"

export interface CheckInMonth {
  year: number
  /** 1–12 */
  month: number
}

/** The calendar month before `now` (server local time). */
export function previousMonth(now: Date): CheckInMonth {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** Parses "YYYY-MM". */
export function parseCheckInMonth(value: string): CheckInMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) return null
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null
}

const round = (n: number) => Math.round(n * 100) / 100

/** Spending as the plan counts it: lifestyle categories only, rounded to cents. */
export function actualSpending(cashflow: MonthCashflow): { spending: number; byCategory: Record<string, number> } {
  const entries = [...cashflow.categories.entries()].filter(([cat]) => !NOT_PLAN_SPENDING.has(cat))
  return {
    spending: round(entries.reduce((sum, [, v]) => sum + v, 0)),
    byCategory: Object.fromEntries(entries.map(([cat, v]) => [cat, round(v)])),
  }
}

async function actualsFor(userId: string, { year, month }: CheckInMonth) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const lastDay = new Date(Date.UTC(year, month, 0))
  const [cashflow, netWorth] = await Promise.all([monthlyCashflow(userId, start), actualFinancialNetWorth(userId, lastDay)])
  const { spending, byCategory } = actualSpending(cashflow)
  return { actualNetWorth: netWorth, actualIncome: round(cashflow.income), actualSpending: spending, actualByCategory: byCategory }
}

/**
 * Records a finished month against the primary plan. The planned side is written once, when the row is created,
 * so later plan edits don't rewrite the past; running again only refreshes the actuals (late transactions).
 */
export async function recordCheckIn(userId: string, when: CheckInMonth, source: CheckInSource = "live"): Promise<CheckInResult> {
  const month = new Date(Date.UTC(when.year, when.month - 1, 1))
  const existing = await db.planCheckIn.findUnique({ where: { userId_month: { userId, month } }, select: { id: true } })
  if (existing) {
    await db.planCheckIn.update({ where: { id: existing.id }, data: await actualsFor(userId, when) })
    return "updated"
  }
  const plan = await db.plan.findFirst({
    where: { userId, isPrimary: true },
    select: { id: true, name: true, document: true, updatedAt: true },
  })
  const doc = plan ? readPlanDocument(plan.id, plan.document) : null
  const planned = doc ? plannedForMonth(doc, simulatePlan(doc), when.year, when.month) : null
  if (!plan || !planned) return "skipped"
  await db.planCheckIn.create({
    data: {
      userId,
      month,
      planId: plan.id,
      planName: plan.name,
      planHash: createHash("sha256").update(JSON.stringify(plan.document)).digest("hex"),
      planUpdatedAt: plan.updatedAt,
      plannedSource: source,
      plannedNetWorth: planned.netWorth,
      plannedIncome: planned.income,
      plannedSpending: planned.spending,
      plannedByCategory: planned.byCategory,
      plannedOneTime: planned.oneTime,
      ...(await actualsFor(userId, when)),
    },
  })
  return "created"
}
