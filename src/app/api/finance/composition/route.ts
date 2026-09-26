import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { buildFinanceComposition, FINANCE_COMPOSITION_RANGES } from "@/lib/finance/finance-composition"
import type { FinanceCompositionMode } from "@/types/composition"

const MODES: readonly FinanceCompositionMode[] = ["category", "account"]

/**
 * GET /api/finance/composition?mode=category|account&range=1w..all&includeInvestments=true
 * Stacked breakdown of finance assets over time (see finance-composition.ts).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9500", "Authentication required", 401)

  const params = new URL(req.url).searchParams
  const mode = params.get("mode") as FinanceCompositionMode | null
  const range = params.get("range") ?? "1y"
  if (!mode || !MODES.includes(mode)) return apiError("F9501", "Invalid mode", 400)
  if (!(range in FINANCE_COMPOSITION_RANGES)) return apiError("F9502", "Invalid range", 400)
  const includeInvestments = params.get("includeInvestments") !== "false"

  try {
    return NextResponse.json(await buildFinanceComposition(user.id, mode, range, includeInvestments))
  } catch (error) {
    return apiError("F9503", "Failed to load finance breakdown", 500, error)
  }
}
