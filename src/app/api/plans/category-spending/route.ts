import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { gatherBudgetContext } from "@/lib/finance/budget-ai-context"

/**
 * GET: spending by budget category over the same 12 months "Start from my data" uses: the average and median
 * month, and the budget where one is set.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLNA1", "Authentication required", 401)
  try {
    const context = await gatherBudgetContext(user.id)
    const budgets = new Map(context.currentBudgets.filter((b) => b.monthlyLimit > 0).map((b) => [b.category, b.monthlyLimit]))
    const spent = context.categories.map((c) => ({
      category: c.category,
      avgMonthly: c.avgMonthly,
      medianMonthly: c.medianMonthly,
      budgetMonthly: budgets.get(c.category) ?? null,
    }))
    const budgetedOnly = [...budgets.entries()]
      .filter(([category]) => !spent.some((s) => s.category === category))
      .map(([category, budgetMonthly]) => ({ category, avgMonthly: 0, medianMonthly: 0, budgetMonthly }))
    return NextResponse.json({ months: context.months.length, categories: [...spent, ...budgetedOnly] })
  } catch (err) {
    return apiError("PLNA2", "Failed to load spending by category", 500, err)
  }
}
