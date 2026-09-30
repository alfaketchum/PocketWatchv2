/**
 * Wallet history top-up worker — keeps each wallet's stored Zerion value history current (last month
 * re-fetched once it's more than ~a day old) and rebuilds the chart caches from it.
 *
 * POST /api/internal/wallet-history-refresh
 * Bearer-secret (reuses SNAPSHOT_WORKER_SECRET). Runs daily via the scheduler.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkAuthFailureLimit, isAuthorizedBearer } from "@/lib/internal-auth"
import { refreshWalletHistories } from "@/lib/portfolio/wallet-history-refresh"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const WORKER_SECRET = process.env.SNAPSHOT_WORKER_SECRET ?? ""
const MAX_USERS = 500

export async function POST(request: NextRequest) {
  if (!isAuthorizedBearer(request, WORKER_SECRET)) {
    const rl = checkAuthFailureLimit(request)
    if (!rl.ok) return NextResponse.json(rl.response, { status: 429, headers: rl.headers })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const owners = await db.trackedWallet.findMany({ distinct: ["userId"], select: { userId: true }, take: MAX_USERS })
    let refreshed = 0
    let errors = 0
    for (const { userId } of owners) {
      try {
        const result = await refreshWalletHistories(userId)
        refreshed += result.refreshed
        console.log(`[wallet-history] ${userId.slice(0, 8)}: topped up ${result.refreshed}${result.stopped ? `, stopped: ${result.stopped}` : ""}`)
      } catch (error) {
        errors++
        console.error(`[wallet-history] failed for ${userId}:`, error instanceof Error ? error.message : error)
      }
    }
    return NextResponse.json({ refreshed, errors })
  } catch (error) {
    console.error("[wallet-history] worker failed:", error)
    return NextResponse.json({ error: "Wallet history worker failed" }, { status: 500 })
  }
}
