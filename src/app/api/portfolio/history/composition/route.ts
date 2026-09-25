import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { buildComposition } from "@/lib/portfolio/portfolio-composition"
import type { CompositionMode } from "@/types/composition"
import { normalizeRange, RANGE_SECONDS } from "@/lib/portfolio/snapshot-helpers"

/**
 * GET /api/portfolio/history/composition?mode=stable|asset&range=ALL|1Y|3M|1W|1D
 * Stacked breakdown of portfolio value over time (see portfolio-composition.ts).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9140", "Authentication required", 401)

  const params = request.nextUrl.searchParams
  const mode = params.get("mode")
  if (mode !== "stable" && mode !== "asset") return apiError("E9141", "mode must be stable or asset", 400)
  const range = normalizeRange(params.get("range"))
  const since = range === "ALL" ? new Date(0) : new Date(Date.now() - RANGE_SECONDS[range] * 1000)

  try {
    return NextResponse.json(await buildComposition(user.id, mode as CompositionMode, since))
  } catch (error) {
    return apiError("E9142", "Failed to load portfolio breakdown", 500, error)
  }
}
