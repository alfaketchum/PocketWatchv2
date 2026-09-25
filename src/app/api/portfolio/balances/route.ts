import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getRefreshMeta, queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"
import { buildBalancesResponse, cache, cacheBalancesResponse, getFreshCachedResponse } from "@/lib/portfolio/balances-response"

export const maxDuration = 60

/** GET /api/portfolio/balances — fetch portfolio (cached) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9040", "Authentication required", 401)

  try {
    // Serve from cache if fresh
    const cached = getFreshCachedResponse(user.id)
    if (cached) {
      const refreshMeta = await getRefreshMeta(user.id)
      return NextResponse.json({ ...cached, meta: { fromCache: true, ...refreshMeta } })
    }

    const built = await buildBalancesResponse(user.id)
    // Only cache responses with actual position data — throttle fallbacks
    // with empty positions should not poison the cache for 5 minutes
    const data = (built as { isThrottled?: boolean }).isThrottled ? built : cacheBalancesResponse(user.id, built)
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...data, meta: { fromCache: data !== built, ...refreshMeta } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid") && msg.includes("API key")) {
      return apiError("E9041", "Invalid API key — update it in Portfolio Settings.", 401, error)
    }
    if (msg.includes("rate limit") || msg.includes("429")) {
      return apiError("E9042", msg, 429, error)
    }
    return apiError("E9043", "Failed to fetch portfolio balances", 500, error)
  }
}

/** POST /api/portfolio/balances — force refresh (bust cache) */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9044", "Authentication required", 401)

  try {
    const refresh = await queuePortfolioRefresh(user.id, { reason: "manual_refresh" })

    const cached = cache.get(user.id)
    let data: object
    let fromCache = false

    if (cached) {
      // Have a cached response — return it immediately, run refresh in background
      data = cached.data
      fromCache = true
      if (refresh.queued && refresh.jobId) {
        void runPortfolioRefreshJob(refresh.jobId).catch((error) => {
          console.warn("[balances] Async refresh job failed:", error)
        })
      }
    } else {
      // No cache — build response once. If a refresh job was queued, it will
      // share the same Zerion fetch via zerion-cache deduplication, so we
      // don't fire two separate API calls.
      if (refresh.queued && refresh.jobId) {
        void runPortfolioRefreshJob(refresh.jobId).catch((error) => {
          console.warn("[balances] Async refresh job failed:", error)
        })
      }
      data = await buildBalancesResponse(user.id)
      data = cacheBalancesResponse(user.id, data)
    }

    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({
      ...data,
      refresh,
      meta: {
        fromCache,
        refreshed: false,
        ...refreshMeta,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid") && msg.includes("API key")) {
      return apiError("E9045", "Invalid API key — update it in Portfolio Settings.", 401, error)
    }
    return apiError("E9046", "Failed to refresh portfolio balances", 500, error)
  }
}
