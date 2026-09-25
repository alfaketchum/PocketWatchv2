import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getTokenPnlStatus, refreshTokenPnl } from "@/lib/portfolio/roi/token-pnl-sync"
import { buildRoiResponse } from "@/lib/portfolio/roi/roi-response"
import { runAsBackgroundZerion } from "@/lib/portfolio/zerion-request-meter"

export const maxDuration = 60

/**
 * GET /api/portfolio/roi — per-token cost basis / PnL + venue positions.
 * Serves stored PnL immediately; when it's over a day old, kicks off a
 * background refresh (~1 Zerion request per wallet).
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9130", "Authentication required", 401)

  try {
    const status = await getTokenPnlStatus(user.id)
    const startRefresh = status.due && !status.running
    if (startRefresh) void runAsBackgroundZerion(() => refreshTokenPnl(user.id))

    const data = await buildRoiResponse(user.id, {
      refreshedAt: status.refreshedAt,
      running: status.running || startRefresh,
    })
    return NextResponse.json(data)
  } catch (error) {
    return apiError("E9131", "Failed to load ROI data", 500, error)
  }
}
