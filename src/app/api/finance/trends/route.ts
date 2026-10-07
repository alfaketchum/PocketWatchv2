import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { getCached, setCache } from "@/lib/cache"
import { bucketCashflow } from "@/lib/finance/monthly-cashflow"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

const paramsSchema = z.object({
  months: z.coerce.number().int().min(1).max(48).default(6),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9001", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const parsed = paramsSchema.safeParse({ months: searchParams.get("months") ?? 6 })
  if (!parsed.success) {
    return apiError("F9002", "Invalid months parameter (1-48)", 400)
  }
  const { months } = parsed.data

  const cacheKey = `finance-trends:${user.id}:${months}:${new Date().toISOString().slice(0, 7)}`
  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    // Find the most recent N months that have data (not hardcoded calendar months)
    // This makes sandbox/historical data work correctly
    const distinctMonths = await db.$queryRaw<Array<{ month: string }>>`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
      FROM "FinanceTransaction"
      WHERE "userId" = ${user.id}
        AND "isDuplicate" = false
        AND "isExcluded" = false
      ORDER BY month DESC
      LIMIT ${months}
    `

    if (distinctMonths.length === 0) {
      return NextResponse.json({ months: [] })
    }

    const monthStrings = distinctMonths.map((m) => m.month)

    // Get all transactions for those months in one query
    const oldestMonth = monthStrings[monthStrings.length - 1]
    const newestMonth = monthStrings[0]
    const startDate = new Date(`${oldestMonth}-01`)
    const endParts = newestMonth.split("-")
    const endDate = new Date(
      Number(endParts[0]),
      Number(endParts[1]), // month is 0-indexed, but we want first day of next month
      1
    )

    const transactions = await db.financeTransaction.findMany({
      where: {
        userId: user.id,
        isDuplicate: false,
        isExcluded: false,
        date: { gte: startDate, lt: endDate },
      },
      select: {
        date: true,
        amount: true,
        category: true,
      },
    })

    const monthMap = bucketCashflow(transactions, monthStrings)

    // Collect all categories across all months so every month has a value for each
    const allCategories = new Set<string>()
    for (const bucket of monthMap.values()) {
      for (const cat of bucket.categories.keys()) allCategories.add(cat)
    }

    const result = monthStrings
      .reverse()
      .map((month) => {
        const bucket = monthMap.get(month)!
        const income = Math.round(bucket.income * 100) / 100
        const spending = Math.round(bucket.spending * 100) / 100
        const net = Math.round((income - spending) * 100) / 100
        const savingsRate = income > 0 ? Math.round(((income - spending) / income) * 1000) / 10 : 0

        const categories: Record<string, number> = {}
        for (const cat of allCategories) {
          categories[cat] = Math.round((bucket.categories.get(cat) ?? 0) * 100) / 100
        }

        return { month, income, spending, net, savingsRate, categories }
      })

    const response = { months: result }
    setCache(cacheKey, response, CACHE_TTL)
    return NextResponse.json(response)
  } catch (err) {
    return apiError("F9003", "Failed to compute trends", 500, err)
  }
}
