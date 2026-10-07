/**
 * Income and spending per calendar month from transactions, shared by the trends chart and the plan check-ins.
 * Plaid signs: positive is money out. Income is money in categorized "Income" (refunds and transfer credits
 * don't count); spending is money out outside the non-spending categories.
 */

import { db } from "@/lib/db"

export const NON_SPENDING = new Set(["Transfer", "Income", "Investment", "Crypto"])

export interface CashflowTx {
  date: Date
  amount: number
  category: string | null
}

export interface MonthCashflow {
  income: number
  spending: number
  categories: Map<string, number>
}

/** Buckets transactions into the given months ("YYYY-MM", UTC); transactions outside them are ignored. */
export function bucketCashflow(transactions: CashflowTx[], months: string[]): Map<string, MonthCashflow> {
  const byMonth = new Map<string, MonthCashflow>(months.map((m) => [m, { income: 0, spending: 0, categories: new Map() }]))
  for (const tx of transactions) {
    const bucket = byMonth.get(tx.date.toISOString().slice(0, 7))
    if (!bucket) continue
    if (tx.amount < 0) {
      if ((tx.category ?? "").toLowerCase() === "income") bucket.income += Math.abs(tx.amount)
      continue
    }
    const cat = tx.category ?? "Uncategorized"
    if (NON_SPENDING.has(cat)) continue
    bucket.spending += tx.amount
    bucket.categories.set(cat, (bucket.categories.get(cat) ?? 0) + tx.amount)
  }
  return byMonth
}

/** One month's settled cash flow (pending transactions left out). `monthStart` is the first day, UTC. */
export async function monthlyCashflow(userId: string, monthStart: Date): Promise<MonthCashflow> {
  const end = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1))
  const transactions = await db.financeTransaction.findMany({
    where: { userId, isDuplicate: false, isExcluded: false, isPending: false, date: { gte: monthStart, lt: end } },
    select: { date: true, amount: true, category: true },
    take: 20_000,
  })
  const key = monthStart.toISOString().slice(0, 7)
  return bucketCashflow(transactions, [key]).get(key)!
}
