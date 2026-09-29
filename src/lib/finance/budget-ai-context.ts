/**
 * Gathers the spending picture the AI budget generator reasons over:
 * per-category monthly history, income, subscriptions, current budgets and
 * the biggest merchants in each large category.
 */

import { db } from "@/lib/db"
import { getBudgetableCategories } from "@/lib/finance/categories"
import { DEFAULT_BUDGET_LOOKBACK } from "@/lib/finance/budget-lookback"

const TOP_MERCHANTS_PER_CATEGORY = 3
const LARGE_CATEGORY_LIMIT = 8
// Same exclusions the budget totals use.
const NON_SPENDING = new Set(["Transfer", "Income", "Investment", "Crypto"])
const SUBSCRIPTION_TYPES = new Set(["subscription", "insurance", "membership"])
const MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 4.33, biweekly: 2.17, semimonthly: 2, monthly: 1, quarterly: 1 / 3, semi_annual: 1 / 6, yearly: 1 / 12, annual: 1 / 12,
}

export interface CategoryHistory {
  category: string
  /** Oldest → newest, one entry per complete month. */
  monthly: number[]
  avgMonthly: number
  /** Median month — robust to one-off spikes. */
  medianMonthly: number
  topMerchants: Array<{ name: string; avgMonthly: number }>
}

export interface BudgetContext {
  months: string[]
  categories: CategoryHistory[]
  avgMonthlySpend: number
  /** Sum of per-category medians. */
  typicalMonthlySpend: number
  avgMonthlyIncome: number
  incomeOverride: number | null
  subscriptions: Array<{ name: string; monthly: number; category: string | null }>
  subscriptionsMonthly: number
  currentBudgets: Array<{ category: string; monthlyLimit: number }>
}

const round2 = (n: number) => Math.round(n * 100) / 100

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The last N complete calendar months as YYYY-MM, oldest first. */
function completeMonths(now: Date, count: number): string[] {
  const out: string[] = []
  for (let i = count; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return out
}

interface HistoryTx { date: Date; amount: number; category: string | null; merchantName: string | null; name: string }

function summarizeSpending(txs: HistoryTx[], months: string[]) {
  const budgetable = new Set(getBudgetableCategories())
  const byCat = new Map<string, { monthly: Map<string, number>; merchants: Map<string, number> }>()
  let income = 0
  for (const tx of txs) {
    const month = tx.date.toISOString().slice(0, 7)
    if (tx.amount < 0) {
      if (tx.category === "Income") income += Math.abs(tx.amount)
      continue
    }
    const cat = tx.category ?? "Uncategorized"
    if (NON_SPENDING.has(cat) || !budgetable.has(cat)) continue
    const entry = byCat.get(cat) ?? { monthly: new Map(), merchants: new Map() }
    entry.monthly.set(month, (entry.monthly.get(month) ?? 0) + tx.amount)
    const merchant = tx.merchantName ?? tx.name
    entry.merchants.set(merchant, (entry.merchants.get(merchant) ?? 0) + tx.amount)
    byCat.set(cat, entry)
  }

  const n = months.length
  const categories: CategoryHistory[] = [...byCat.entries()]
    .map(([category, e]) => {
      const monthly = months.map((m) => round2(e.monthly.get(m) ?? 0))
      const avgMonthly = round2(monthly.reduce((s, v) => s + v, 0) / n)
      const topMerchants = [...e.merchants.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_MERCHANTS_PER_CATEGORY)
        .map(([name, total]) => ({ name, avgMonthly: round2(total / n) }))
      return { category, monthly, avgMonthly, medianMonthly: round2(median(monthly)), topMerchants }
    })
    .sort((a, b) => b.avgMonthly - a.avgMonthly)
    .map((c, i) => (i < LARGE_CATEGORY_LIMIT ? c : { ...c, topMerchants: [] }))

  return { categories, avgMonthlyIncome: round2(income / n) }
}

/** Requested complete months, dropping any before the user's first transaction. */
async function availableMonths(userId: string, now: Date, lookback: number): Promise<string[]> {
  const first = await db.financeTransaction.aggregate({
    where: { userId, isDuplicate: false, isExcluded: false },
    _min: { date: true },
  })
  const firstDate = first._min.date
  const months = completeMonths(now, lookback)
  if (!firstDate) return months
  // History runs out inside the window: skip the first month too if it's only partially covered.
  const firstMonth = firstDate.toISOString().slice(0, 7)
  const partial = firstDate.getUTCDate() > 1
  const clipped = months.filter((m) => (partial ? m > firstMonth : m >= firstMonth))
  return clipped.length > 0 ? clipped : months.slice(-1)
}

export async function gatherBudgetContext(userId: string, lookback: number = DEFAULT_BUDGET_LOOKBACK, now = new Date()): Promise<BudgetContext> {
  const months = await availableMonths(userId, now, lookback)
  const start = new Date(`${months[0]}-01T00:00:00`)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)

  const [txs, user, subs, budgets] = await Promise.all([
    db.financeTransaction.findMany({
      where: { userId, isDuplicate: false, isExcluded: false, date: { gte: start, lt: end } },
      select: { date: true, amount: true, category: true, merchantName: true, name: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { monthlyIncomeOverride: true } }),
    db.financeSubscription.findMany({
      where: { userId, status: "active" },
      select: { merchantName: true, nickname: true, amount: true, frequency: true, category: true, billType: true },
      take: 200,
    }),
    db.financeBudget.findMany({
      where: { userId, isActive: true },
      select: { category: true, monthlyLimit: true },
    }),
  ])

  const { categories, avgMonthlyIncome } = summarizeSpending(txs, months)
  const subscriptions = subs
    .filter((s) => SUBSCRIPTION_TYPES.has(s.billType ?? ""))
    .map((s) => ({
      name: s.nickname ?? s.merchantName,
      monthly: round2(s.amount * (MONTHLY_MULTIPLIER[s.frequency] ?? 1)),
      category: s.category,
    }))

  return {
    months,
    categories,
    avgMonthlySpend: round2(categories.reduce((s, c) => s + c.avgMonthly, 0)),
    typicalMonthlySpend: round2(categories.reduce((s, c) => s + c.medianMonthly, 0)),
    avgMonthlyIncome,
    incomeOverride: user?.monthlyIncomeOverride ?? null,
    subscriptions,
    subscriptionsMonthly: round2(subscriptions.reduce((s, x) => s + x.monthly, 0)),
    currentBudgets: budgets,
  }
}
