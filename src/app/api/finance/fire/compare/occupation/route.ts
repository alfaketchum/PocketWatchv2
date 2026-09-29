import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getCached, setCache } from "@/lib/cache"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { fetchOewsPercentiles, type OewsResult } from "@/lib/fire/bls-oews"

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** GET ?soc=15-1252&state=CA — BLS OEWS annual wage percentiles (national + state), cached 30 days. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("FIRE12", "Authentication required", 401)

  const soc = req.nextUrl.searchParams.get("soc") ?? ""
  const stateParam = req.nextUrl.searchParams.get("state")
  const state = stateParam && /^[A-Z]{2}$/.test(stateParam) ? stateParam : null
  if (!/^\d{2}-\d{4}$/.test(soc)) return apiError("FIRE13", "Invalid occupation code", 400)

  const cacheKey = `fire-oews:${soc}:${state ?? "US"}`
  const cached = getCached<OewsResult>(cacheKey)
  if (cached) return NextResponse.json({ ...cached, source: "bls" })

  try {
    const result = await fetchOewsPercentiles(soc, state, await getServiceKey(user.id, "bls"))
    if (result.national || result.state) setCache(cacheKey, result, CACHE_TTL_MS)
    return NextResponse.json({ ...result, source: "bls" })
  } catch (err) {
    // The client falls back to the bundled Census median; this is informational, not fatal.
    return apiError("FIRE14", "BLS wage data is unavailable right now", 502, err)
  }
}
