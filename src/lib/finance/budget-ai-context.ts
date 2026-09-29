/**
 * Gathers the lifestyle-spending picture the AI budget generator reasons over:
 * per-category and per-subcategory monthly history, subscriptions, current
 * budgets and top merchants. Taxes are context only; income shapes the budget
 * only when it's steady (see classifyIncome).
 */

import { db } from "@/lib/db"
import { DEFAULT_BUDGET_LOOKBACK, classifyIncome, getLifestyleCategories, type IncomeProfile } from "@/lib/finance/budget-builder-config"

const TOP_MERCHANTS_PER_CATEGORY = 3
const MAX_SUBCATEGORIES = 6
const LARGE_CATEGORY_LIMIT = 8
const TAX_CATEGORY = "Taxes"
const SUBSCRIPTION_TYPES = new Set(["subscription", "insurance", "membership"])
const MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 4.33, biweekly: 2.17, semimonthly: 2, monthly: 1, quarterly: 1 / 3, semi_annual: 1 / 6, yearly: 1 / 12, annual: 1 / 12,
}

export interface SpendSeries {
  avgMonthly: number
  /** Median month — robust to one-off spikes. */
  medianMonthly: number
  /** Months (of the window) with any spend. */
  activeMonths: number
}

export interface CategoryHistory extends SpendSeries {
  category: string
  /** Oldest → newest, one entry per complete month. */
  monthly: number[]
  subcategories: Array<SpendSeries & { name: string; txCount: number }>
  topMerchants: Array<{ name: string; avgMonthly: number }>
}

export interface BudgetContext {
  months: string[]
  categories: CategoryHistory[]
  avgMonthlySpend: number
  /** Sum of per-category medians. */
  typicalMonthlySpend: number
  income: IncomeProfile
  taxes: { total: number; paymentMonths: number }
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

function series(byMonth: Map<string, number>, months: string[]): SpendSeries & { monthly: number[] } {
  const monthly = months.map((m) => round2(byMonth.get(m) ?? 0))
  return {
    monthly,
    avgMonthly: round2(monthly.reduce((s, v) => s + v, 0) / months.length),
    medianMonthly: round2(median(monthly)),
    activeMonths: monthly.filter((v) => v > 0).length,
  }
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

interface HistoryTx { date: Date; amount: number; category: string | null; subcategory: string | null; merchantName: string | null; name: string }

interface CategoryAcc {
  monthly: Map<string, number>
  merchants: Map<string, number>
  subs: Map<string, { monthly: Map<string, number>; count: number }>
}

const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)

function accumulate(txs: HistoryTx[]) {
  const lifestyle = new Set(getLifestyleCategories())
  const byCat = new Map<string, CategoryAcc>()
  const taxMonths = new Map<string, number>()
  const incomeMonths = new Map<string, number>()
  for (const tx of txs) {
    const month = tx.date.toISOString().slice(0, 7)
    if (tx.amount < 0) {
      if (tx.category === "Income") bump(incomeMonths, month, Math.abs(tx.amount))
      continue
    }
    if (tx.category === TAX_CATEGORY) { bump(taxMonths, month, tx.amount); continue }
    const cat = tx.category ?? "Uncategorized"
    if (!lifestyle.has(cat)) continue
    const acc = byCat.get(cat) ?? { monthly: new Map(), merchants: new Map(), subs: new Map() }
    bump(acc.monthly, month, tx.amount)
    bump(acc.merchants, tx.merchantName ?? tx.name, tx.amount)
    const subName = tx.subcategory ?? "(no subcategory)"
    const sub = acc.subs.get(subName) ?? { monthly: new Map(), count: 0 }
    bump(sub.monthly, month, tx.amount)
    acc.subs.set(subName, { ...sub, count: sub.count + 1 })
    byCat.set(cat, acc)
  }
  return { byCat, taxMonths, incomeMonths }
}

function toHistory(category: string, acc: CategoryAcc, months: string[]): CategoryHistory {
  const n = months.length
  const subcategories = [...acc.subs.entries()]
    .map(([name, s]) => {
      const { avgMonthly, medianMonthly, activeMonths } = series(s.monthly, months)
      return { name, txCount: s.count, avgMonthly, medianMonthly, activeMonths }
    })
    .sort((a, b) => b.avgMonthly - a.avgMonthly)
    .slice(0, MAX_SUBCATEGORIES)
  const topMerchants = [...acc.merchants.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_MERCHANTS_PER_CATEGORY)
    .map(([name, total]) => ({ name, avgMonthly: round2(total / n) }))
  return { category, ...series(acc.monthly, months), subcategories, topMerchants }
}

export async function gatherBudgetContext(userId: string, lookback: number = DEFAULT_BUDGET_LOOKBACK, now = new Date()): Promise<BudgetContext> {
  const months = await availableMonths(userId, now, lookback)
  const start = new Date(`${months[0]}-01T00:00:00`)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)

  const [txs, user, subs, budgets] = await Promise.all([
    db.financeTransaction.findMany({
      where: { userId, isDuplicate: false, isExcluded: false, date: { gte: start, lt: end } },
      select: { date: true, amount: true, category: true, subcategory: true, merchantName: true, name: true },
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

  const { byCat, taxMonths, incomeMonths } = accumulate(txs)
  const categories = [...byCat.entries()]
    .map(([cat, acc]) => toHistory(cat, acc, months))
    .sort((a, b) => b.avgMonthly - a.avgMonthly)
    .map((c, i) => (i < LARGE_CATEGORY_LIMIT ? c : { ...c, topMerchants: [] }))

  const subscriptions = subs
    .filter((s) => SUBSCRIPTION_TYPES.has(s.billType ?? ""))
    .map((s) => ({
      name: s.nickname ?? s.merchantName,
      monthly: round2(s.amount * (MONTHLY_MULTIPLIER[s.frequency] ?? 1)),
      category: s.category,
    }))

  const typicalMonthlySpend = round2(categories.reduce((s, c) => s + c.medianMonthly, 0))
  return {
    months,
    categories,
    avgMonthlySpend: round2(categories.reduce((s, c) => s + c.avgMonthly, 0)),
    typicalMonthlySpend,
    income: classifyIncome(months.map((m) => incomeMonths.get(m) ?? 0), typicalMonthlySpend, user?.monthlyIncomeOverride ?? null),
    taxes: { total: round2([...taxMonths.values()].reduce((s, v) => s + v, 0)), paymentMonths: taxMonths.size },
    subscriptions,
    subscriptionsMonthly: round2(subscriptions.reduce((s, x) => s + x.monthly, 0)),
    currentBudgets: budgets,
  }
}
