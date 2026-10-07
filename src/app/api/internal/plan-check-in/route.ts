/**
 * Plan check-in worker: records last month against each user's primary plan.
 *
 * POST /api/internal/plan-check-in  body (optional): { month: "YYYY-MM" }
 *
 * Runs on the 1st (records the month) and the 8th (refreshes its actuals once late transactions post).
 * Protected by SNAPSHOT_WORKER_SECRET.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { parseCheckInMonth, previousMonth, recordCheckIn } from "@/lib/plans/check-in/record-check-in"

export const maxDuration = 300

const WORKER_SECRET = process.env.SNAPSHOT_WORKER_SECRET ?? ""
const MAX_USERS = 1000

const bodySchema = z.object({ month: z.string().optional() })

function isAuthorized(request: NextRequest): boolean {
  if (!WORKER_SECRET) return false
  return (request.headers.get("authorization") ?? "") === `Bearer ${WORKER_SECRET}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return apiError("PLNC1", "Unauthorized", 401)
  try {
    const body = bodySchema.safeParse(await request.json().catch(() => ({})))
    const month = body.success && body.data.month ? parseCheckInMonth(body.data.month) : previousMonth(new Date())
    if (!month) return apiError("PLNC2", "month must be YYYY-MM", 400)

    const plans = await db.plan.findMany({ where: { isPrimary: true }, select: { userId: true }, take: MAX_USERS })
    const results: Array<{ userId: string; status: string; error?: string }> = []
    for (const { userId } of plans) {
      try {
        results.push({ userId, status: await recordCheckIn(userId, month) })
      } catch (err) {
        console.error(`[plan-check-in] user ${userId} failed:`, err)
        results.push({ userId, status: "failed", error: err instanceof Error ? err.message : String(err) })
      }
    }
    return NextResponse.json({ success: true, month, processed: results.length, results })
  } catch (err) {
    return apiError("PLNC3", "Plan check-in run failed", 500, err)
  }
}
