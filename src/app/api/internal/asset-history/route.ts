/**
 * Asset History Worker — advances the "By asset" chart's background work:
 * registers current holdings, weekly discovery of past tokens, and the
 * budget-capped Zerion history backfill (60 pairs/run, low priority).
 *
 * POST /api/internal/asset-history
 * Protected by SNAPSHOT_WORKER_SECRET. Scheduled every 15 min (lib/scheduler.ts),
 * so a backfill finishes on its own without anyone opening the chart.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { runAssetHistoryJob } from "@/lib/portfolio/asset-history-job"

export const maxDuration = 300

const WORKER_SECRET = process.env.SNAPSHOT_WORKER_SECRET ?? ""
const MAX_USERS = 100

export async function POST(request: NextRequest) {
  if (!WORKER_SECRET || request.headers.get("authorization") !== `Bearer ${WORKER_SECRET}`) {
    return apiError("E9150", "Unauthorized", 401)
  }

  try {
    const users = await db.user.findMany({
      where: { trackedWallets: { some: {} } },
      select: { id: true },
      take: MAX_USERS,
    })
    for (const user of users) {
      await runAssetHistoryJob(user.id)
    }
    return NextResponse.json({ success: true, processed: users.length })
  } catch (error) {
    return apiError("E9151", "Asset history worker failed", 500, error)
  }
}
