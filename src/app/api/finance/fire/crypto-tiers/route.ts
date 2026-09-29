import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getCached, setCache } from "@/lib/cache"
import { buildBalancesForUser } from "@/lib/portfolio/balances-read"
import { summarizeTiers, type TierSummary } from "@/lib/fire/crypto-tiers"
import { getTop100Symbols } from "@/lib/fire/top-coins"

const CACHE_TTL_MS = 5 * 60 * 1000

type CryptoTiersResponse = TierSummary & { top100Source: "coingecko" | "coinlore" | "fallback" }

/** GET: the user's current crypto split into BTC / ETH / top-100 / long tail / stablecoins. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FIRE06", "Authentication required", 401)

  const cacheKey = `fire-crypto-tiers:${user.id}`
  const cached = getCached<CryptoTiersResponse>(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const [balances, top] = await Promise.all([buildBalancesForUser(user.id), getTop100Symbols(user.id)])
    if (balances.error) return apiError("FIRE07", "Crypto balances are unavailable right now", 503)
    const response: CryptoTiersResponse = { ...summarizeTiers(balances.positions, top.symbols), top100Source: top.source }
    setCache(cacheKey, response, CACHE_TTL_MS)
    return NextResponse.json(response)
  } catch (err) {
    return apiError("FIRE08", "Failed to classify crypto holdings", 500, err)
  }
}
