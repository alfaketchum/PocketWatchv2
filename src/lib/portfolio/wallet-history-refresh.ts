/**
 * Daily top-up of each wallet's stored Zerion value history (WalletChartCache).
 *
 * History is fetched in full once per wallet; after that this job keeps it current: any wallet whose
 * history ends more than REFRESH_AFTER_SEC ago gets its last month re-fetched (1 request) and merged in,
 * then ChartCache and StablecoinChartCache are rebuilt from the stored rows. Keeps a reserve of the
 * day's Zerion quota, skips a key that's cooling down, and stops (to retry next run) when Zerion throttles.
 */

import { db } from "@/lib/db"
import { buildWalletFingerprint } from "./snapshot-helpers"
import { getProviderDailyBudget } from "./provider-daily-budget"
import { getServiceKey } from "./service-keys"
import { refreshRecentWalletHistory, syncStablecoinCharts, syncWalletCharts, walletsEndingBefore, type Series } from "./wallet-chart-cache"
import { isZerionKeyPaused } from "./zerion-request-meter"

/** Top up a wallet once its history ends more than this long ago. */
const REFRESH_AFTER_SEC = 20 * 60 * 60
/** Zerion requests to leave for everything else today. */
const BUDGET_RESERVE = 500
const WALLET_DELAY_MS = 3_000
const SERIES: Series[] = ["total", "stablecoin"]
const THROTTLED = /rate limit|throttl|cooling down|daily request cap|blocked \((throttled|daily_cap|leased)\)/i

export interface RefreshResult {
  refreshed: number
  /** Why the run stopped early, if it did. */
  stopped: string | null
}

/** Can another Zerion request go out now? Returns the key to use, or why not. */
async function nextKey(userId: string): Promise<{ key: string } | { stop: string }> {
  const budget = await getProviderDailyBudget("zerion")
  if (budget.remaining !== null && budget.remaining < BUDGET_RESERVE) return { stop: `only ${budget.remaining} Zerion requests left today` }
  const key = await getServiceKey(userId, "zerion")
  if (!key) return { stop: "no Zerion key" }
  if (isZerionKeyPaused(key)) return { stop: "Zerion key cooling down" }
  return { key }
}

/** Tops up every stale wallet's history for one user, then rebuilds the summed caches. Never throws. */
export async function refreshWalletHistories(userId: string): Promise<RefreshResult> {
  const wallets = await db.trackedWallet.findMany({ where: { userId }, select: { address: true }, take: 500 })
  const addresses = wallets.map((w) => w.address)
  if (addresses.length === 0) return { refreshed: 0, stopped: null }

  const before = Math.floor(Date.now() / 1000) - REFRESH_AFTER_SEC
  let refreshed = 0
  let stopped: string | null = null
  outer: for (const series of SERIES) {
    for (const address of await walletsEndingBefore(userId, addresses, series, before)) {
      const next = await nextKey(userId)
      if ("stop" in next) {
        stopped = next.stop
        break outer
      }
      if (refreshed > 0) await new Promise((r) => setTimeout(r, WALLET_DELAY_MS))
      try {
        await refreshRecentWalletHistory(userId, next.key, address, series)
        refreshed++
      } catch (err) {
        const message = (err as Error).message
        if (THROTTLED.test(message)) {
          stopped = `Zerion throttling (${message})`
          break outer
        }
        console.warn(`[wallet-history] ${series} top-up failed for ${address.slice(0, 10)}…: ${message}`)
      }
    }
  }

  if (refreshed > 0) await rebuildSummedCaches(userId, addresses)
  return { refreshed, stopped }
}

/** Rebuilds ChartCache and StablecoinChartCache from the stored per-wallet rows (no Zerion calls). */
async function rebuildSummedCaches(userId: string, addresses: string[]): Promise<void> {
  const walletFingerprint = buildWalletFingerprint(addresses)
  try {
    await syncWalletCharts({
      userId,
      zerionKey: await getServiceKey(userId, "zerion"),
      addresses,
      walletFingerprint,
      previousFingerprint: walletFingerprint,
      hasChartCache: false,
      nowSec: Math.floor(Date.now() / 1000),
    })
  } catch (err) {
    console.warn("[wallet-history] chart cache rebuild failed:", (err as Error).message)
  }
  await syncStablecoinCharts(userId, true)
}
