/**
 * Multi-provider balance cache with in-flight request deduplication.
 *
 * Same pattern as zerion-cache.ts but wraps fetchAllWalletBalances
 * (the multi-provider orchestrator) instead of Zerion-only fetching.
 */

import { fetchAllWalletBalances } from "./multi-balance-fetcher"
import type { MultiWalletResult } from "./zerion-client"
import { normalizeWalletAddress } from "./utils"

const FULL_CACHE_TTL_MS = 5 * 60_000   // 5 min — all wallets succeeded
const PARTIAL_CACHE_TTL_MS = 30_000     // 30s — some wallets failed (retry soon)
const CACHE_MAX_SIZE = 100

interface CacheEntry {
  data: MultiWalletResult
  timestamp: number
  ttl: number
  walletSet: string
}

interface WalletInput {
  address: string
  chains: string[]
}

// On globalThis: Next.js can load a separate copy of this module per route
// bundle. Separate copies meant separate caches and no in-flight dedupe across
// routes, so concurrent routes collided on the Zerion lease and got partials.
const g = globalThis as unknown as {
  __pwMultiBalance?: {
    positionsCache: Map<string, CacheEntry>
    inflight: Map<string, { walletSet: string; promise: Promise<MultiWalletResult> }>
  }
}
const { positionsCache, inflight } = (g.__pwMultiBalance ??= { positionsCache: new Map(), inflight: new Map() })

export function balanceWalletSet(wallets: WalletInput[]): string {
  return wallets.map((wallet) =>
    `${normalizeWalletAddress(wallet.address)}:${[...wallet.chains].sort().join(",")}`
  ).sort().join("|")
}

/**
 * Get wallet positions across all providers, using cache and in-flight deduplication.
 */
export async function getCachedMultiProviderPositions(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  const walletSet = balanceWalletSet(wallets)
  // Serve from cache if fresh
  const entry = positionsCache.get(userId)
  const cached = entry?.walletSet === walletSet ? entry : undefined
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data
  }

  // If a fetch is already in-flight for this user, wait for it
  const pending = inflight.get(userId)
  if (pending?.walletSet === walletSet) return pending.promise

  // Start a new fetch and register it as in-flight
  const promise = fetchAllWalletBalances(userId, wallets)
    .then((result) => {
      const ttl = result.failedCount > 0 ? PARTIAL_CACHE_TTL_MS : FULL_CACHE_TTL_MS
      if (positionsCache.size >= CACHE_MAX_SIZE) {
        const oldestKey = positionsCache.keys().next().value
        if (oldestKey) positionsCache.delete(oldestKey)
      }
      positionsCache.set(userId, { data: result, timestamp: Date.now(), ttl, walletSet })
      return result
    })
    .catch((error) => {
      // Serve stale cache on any error
      if (cached) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[multi-cache] Fetch failed (${reason}), serving stale cache`)
        return cached.data
      }
      throw error
    })
    .finally(() => {
      if (inflight.get(userId)?.promise === promise) inflight.delete(userId)
    })

  inflight.set(userId, { walletSet, promise })
  return promise
}

/** Last fetched positions for a user (even if past TTL), without fetching. */
export function peekCachedMultiProviderPositions(userId: string): MultiWalletResult | null {
  return positionsCache.get(userId)?.data ?? null
}

/**
 * Bust the cache for a user. Call on force-refresh (POST).
 */
export function invalidateMultiProviderCache(userId: string): void {
  positionsCache.delete(userId)
}
