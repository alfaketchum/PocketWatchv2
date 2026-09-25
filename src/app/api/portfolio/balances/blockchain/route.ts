import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getCachedMultiProviderPositions } from "@/lib/portfolio/multi-balance-cache"
import { isProviderThrottleError } from "@/lib/portfolio/provider-governor"
import { getRefreshMeta, queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"
import { getHiddenTokenSymbols } from "@/lib/portfolio/hidden-tokens"

export const maxDuration = 60

// On globalThis so invalidation from other routes (hidden-tokens, clear-data)
// reaches the same cache this route serves from.
const g = globalThis as unknown as { __pwBlockchainBalances?: Map<string, { data: object; timestamp: number; ttl: number }> }
const cache = (g.__pwBlockchainBalances ??= new Map())
const CACHE_TTL_MS = 5 * 60_000
const PARTIAL_CACHE_TTL_MS = 30_000 // some wallets failed — retry soon

function isPartial(data: object): boolean {
  return (data as { isPartialFetch?: boolean }).isPartialFetch === true
}

/**
 * Cache a built response and return what to serve. A partial fetch (e.g. EVM
 * throttled, only Solana returned) never replaces a complete cached response.
 */
function cacheResult(cacheKey: string, result: object): object {
  const previous = cache.get(cacheKey)
  if (isPartial(result) && previous && !isPartial(previous.data)) return previous.data
  cache.set(cacheKey, { data: result, timestamp: Date.now(), ttl: isPartial(result) ? PARTIAL_CACHE_TTL_MS : CACHE_TTL_MS })
  return result
}

export function invalidateBlockchainBalancesCache(userId?: string): void {
  if (userId) {
    for (const key of cache.keys()) {
      if (key.startsWith(userId)) cache.delete(key)
    }
    return
  }
  cache.clear()
}

/** Shared builder: fetches positions via multi-provider and builds the per-account response */
async function buildBlockchainBalancesResponse(userId: string, chainFilter: string | null) {
  const wallets = await db.trackedWallet.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { address: true, chains: true },
  })

  if (wallets.length === 0) {
    return { per_account: {}, icons: {}, totals: { assets: {} } }
  }

  const { wallets: walletData, failedCount } = await getCachedMultiProviderPositions(
    userId,
    wallets.map((w) => ({ address: w.address, chains: w.chains })),
  )

  // Filter out hidden tokens
  const hiddenSymbols = await getHiddenTokenSymbols(userId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perAccount: Record<string, Record<string, { assets: Record<string, any> }>> = {}
  const icons: Record<string, string> = {}
  const totalsAssets: Record<string, { amount: string; usd_value: string }> = {}

  for (const wallet of walletData) {
    for (const pos of wallet.positions) {
      const chain = pos.chain
      if (chainFilter && chain !== chainFilter) continue
      if (hiddenSymbols.has(pos.symbol || pos.id)) continue

      if (!perAccount[chain]) perAccount[chain] = {}
      if (!perAccount[chain][wallet.address]) perAccount[chain][wallet.address] = { assets: {} }

      const symbol = pos.symbol || pos.id
      const existing = perAccount[chain][wallet.address].assets[symbol]
      if (existing) {
        // Accumulate values for the same symbol (e.g. wallet + staked positions)
        existing.amount = String(parseFloat(existing.amount) + pos.quantity)
        existing.usd_value = String(parseFloat(existing.usd_value) + pos.value)
        existing.value = existing.usd_value
      } else {
        perAccount[chain][wallet.address].assets[symbol] = {
          amount: String(pos.quantity),
          usd_value: String(pos.value),
          value: String(pos.value),
        }
      }

      if (!totalsAssets[symbol]) {
        totalsAssets[symbol] = { amount: "0", usd_value: "0" }
      }
      totalsAssets[symbol].amount = String(
        parseFloat(totalsAssets[symbol].amount) + pos.quantity
      )
      totalsAssets[symbol].usd_value = String(
        parseFloat(totalsAssets[symbol].usd_value) + pos.value
      )

      if (pos.iconUrl && !icons[symbol]) icons[symbol] = pos.iconUrl
    }
  }

  // Include all tracked wallet addresses so the frontend can show them
  // in dropdowns even if providers returned no positions for them
  const trackedAddresses = wallets.map((w) => w.address)

  return { per_account: perAccount, icons, totals: { assets: totalsAssets }, trackedAddresses, isPartialFetch: failedCount > 0 }
}

/**
 * GET /api/portfolio/balances/blockchain
 * Returns per-account, per-chain breakdown in the format:
 * { per_account: { chainId: { "0xaddr": { assets: { symbol: { amount, usd_value } } } } }, icons: {...} }
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9050", "Authentication required", 401)

  const chainFilter = request.nextUrl.searchParams.get("chain")
  const cacheKey = `${user.id}:${chainFilter ?? "all"}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < cached.ttl && !("error" in cached.data)) {
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...cached.data, meta: { fromCache: true, ...refreshMeta } })
  }

  try {
    const result = await buildBlockchainBalancesResponse(user.id, chainFilter)

    // If providers returned empty but we have a stale cache, serve it
    const isEmpty = Object.keys((result as any).per_account ?? {}).length === 0
    if (isEmpty && cached) {
      const refreshMeta = await getRefreshMeta(user.id)
      return NextResponse.json({ ...cached.data, meta: { fromCache: true, staleReason: "providers_empty", ...refreshMeta } })
    }

    const served = cacheResult(cacheKey, result)
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...served, meta: { fromCache: served !== result, ...refreshMeta } })
  } catch (error) {
    // On error, serve stale cache if available
    if (cached) {
      const refreshMeta = await getRefreshMeta(user.id)
      return NextResponse.json({ ...cached.data, meta: { fromCache: true, staleReason: "provider_error", ...refreshMeta } })
    }
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (isProviderThrottleError(error) || msg.includes("throttled") || msg.includes("rate limit")) {
      return apiError("E9056", "Balance providers temporarily rate-limited. Try again in a moment.", 503, error)
    }
    return apiError("E9052", "Failed to fetch blockchain balances", 500, error)
  }
}

/**
 * POST /api/portfolio/balances/blockchain
 * Queues a shared refresh job and returns the current blockchain read-model.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9053", "Authentication required", 401)

  try {
    const refresh = await queuePortfolioRefresh(user.id, { reason: "manual_refresh:blockchain" })
    if (refresh.queued && refresh.jobId) {
      runPortfolioRefreshJob(refresh.jobId).catch((error) => {
        console.warn("[balances/blockchain] Async refresh job failed:", error)
      })
    }

    const chainFilter = request.nextUrl.searchParams.get("chain")
    const cacheKey = `${user.id}:${chainFilter ?? "all"}`
    const cached = cache.get(cacheKey)
    let result: object
    let fromCache = false

    if (cached) {
      result = cached.data
      fromCache = true
    } else {
      result = cacheResult(cacheKey, await buildBlockchainBalancesResponse(user.id, chainFilter))
    }

    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({
      ...result,
      refresh,
      meta: {
        fromCache,
        refreshed: false,
        ...refreshMeta,
      },
    })
  } catch (error) {
    return apiError("E9055", "Failed to refresh blockchain balances", 500, error)
  }
}
