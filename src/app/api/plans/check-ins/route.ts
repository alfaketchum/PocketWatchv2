import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(120).default(24) })

/** GET: recorded monthly check-ins (plan at the time vs actual), newest first. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLNC4", "Authentication required", 401)
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return apiError("PLNC5", "Invalid query", 400)
  try {
    const rows = await db.planCheckIn.findMany({
      where: { userId: user.id },
      orderBy: { month: "desc" },
      take: parsed.data.limit,
      select: {
        month: true,
        planId: true,
        planName: true,
        planHash: true,
        plannedSource: true,
        plannedNetWorth: true,
        plannedIncome: true,
        plannedSpending: true,
        plannedByCategory: true,
        plannedOneTime: true,
        actualNetWorth: true,
        actualIncome: true,
        actualSpending: true,
        actualByCategory: true,
      },
    })
    const checkIns = rows.map(({ month, ...row }) => ({ ...row, month: month.toISOString().slice(0, 7) }))
    return NextResponse.json({ checkIns })
  } catch (err) {
    return apiError("PLNC6", "Failed to load plan check-ins", 500, err)
  }
}
