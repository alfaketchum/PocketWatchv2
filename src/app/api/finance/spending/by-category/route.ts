import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * GET /api/finance/spending/by-category?startDate&endDate
 * Per-category spend totals over an inclusive date range (positive amounts,
 * excluding transfers/income/investments). Powers the budget period comparison.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8101", "Authentication required", 401)

  const sp = request.nextUrl.searchParams
  const startParam = isoDateSchema.safeParse(sp.get("startDate"))
  const endParam = isoDateSchema.safeParse(sp.get("endDate"))
  if (!startParam.success || !endParam.success) {
    return apiError("F8102", "startDate and endDate (YYYY-MM-DD) are required", 400)
  }

  try {
    const windowStart = new Date(`${startParam.data}T00:00:00`)
    const windowEndExclusive = new Date(`${endParam.data}T00:00:00`)
    windowEndExclusive.setDate(windowEndExclusive.getDate() + 1)

    const spending = await db.financeTransaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        date: { gte: windowStart, lt: windowEndExclusive },
        amount: { gt: 0 },
        isExcluded: false,
        isDuplicate: false,
        category: { notIn: ["Transfer", "Income", "Investment"] },
      },
      _sum: { amount: true },
    })

    const categories = spending
      .map((s) => ({ category: s.category ?? "Uncategorized", total: s._sum.amount ?? 0 }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
    const total = categories.reduce((sum, c) => sum + c.total, 0)

    return NextResponse.json({ categories, total })
  } catch (err) {
    return apiError("F8103", "Failed to load spending by category", 500, err)
  }
}
