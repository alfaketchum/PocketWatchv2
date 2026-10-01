import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getMarketInflation } from "@/lib/plans/market-inflation-source"

/** GET: the bond market's expected inflation (TIPS breakevens), refreshed daily. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN91", "Authentication required", 401)
  try {
    const market = await getMarketInflation()
    if (!market) return apiError("PLN92", "Market inflation data is unavailable right now", 503)
    return NextResponse.json(market)
  } catch (err) {
    return apiError("PLN93", "Failed to load market inflation", 500, err)
  }
}
