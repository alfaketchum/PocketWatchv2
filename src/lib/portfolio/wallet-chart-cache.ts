/**
 * Per-wallet Zerion history, fetched ONCE per wallet and kept (WalletChartCache).
 *
 * Past values don't change, so there is no periodic re-fetch: recent days come
 * from live_refresh snapshots, which the chart already prefers per day. Zerion is
 * only called for wallets with no stored history yet (a newly added wallet, or
 * everything after a forced rebuild) — 2 requests per wallet. The summed series
 * in ChartCache is rebuilt from the stored rows with zero Zerion calls whenever
 * the wallet set changes.
 */

import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { fetchWalletHistory, sumWalletCharts } from "./zerion-client"
import { withProviderPermit } from "./provider-governor"
import { filterValidPoints } from "./snapshot-validation"
import { normalizeWalletAddress } from "./utils"
import { sanitizeZerionSeries, type ChartPoint } from "./snapshot-helpers"

const MAX_ROWS = 200_000
const INSERT_BATCH = 1_000

interface SyncParams {
  userId: string
  zerionKey: string | null
  addresses: string[]
  walletFingerprint: string
  /** settings.chartWalletFingerprint — the wallet set ChartCache was built for */
  previousFingerprint: string
  hasChartCache: boolean
  nowSec: number
  /** Drop all stored history and re-fetch every wallet (manual rebuild only). */
  force?: boolean
}

/** Returns the rebuilt summed series, or null when ChartCache is already current. */
export async function syncWalletCharts(params: SyncParams): Promise<ChartPoint[] | null> {
  const { userId, zerionKey, addresses, walletFingerprint, previousFingerprint, hasChartCache, nowSec, force } = params
  const byNormalized = new Map(addresses.map((a) => [normalizeWalletAddress(a), a]))
  const current = [...byNormalized.keys()]

  if (force) await db.walletChartCache.deleteMany({ where: { userId } })

  const stored = await db.walletChartCache.groupBy({ by: ["address"], where: { userId } })
  const storedSet = new Set(stored.map((r) => r.address))
  const removed = [...storedSet].filter((a) => !byNormalized.has(a))
  const missing = current.filter((a) => !storedSet.has(a))

  if (removed.length > 0) {
    await db.walletChartCache.deleteMany({ where: { userId, address: { in: removed } } })
  }
  if (missing.length > 0) {
    await fetchMissingWallets(userId, zerionKey, missing.map((a) => byNormalized.get(a)!), walletFingerprint)
  }

  const upToDate = !force && missing.length === 0 && removed.length === 0
    && hasChartCache && previousFingerprint === walletFingerprint
  if (upToDate) return null

  return rebuildChartCache(userId, current, walletFingerprint, nowSec)
}

/**
 * Fetch and store history for wallets that have none. Successful wallets are
 * stored even if others fail (each wallet's history is correct on its own), but
 * any failure throws so the summed chart isn't rebuilt with a wallet missing.
 */
async function fetchMissingWallets(
  userId: string,
  zerionKey: string | null,
  addresses: string[],
  walletFingerprint: string,
): Promise<void> {
  if (!zerionKey) throw new Error(`No Zerion key — ${addresses.length} wallet(s) have no chart history`)
  const fpHash = createHash("sha256").update(walletFingerprint).digest("hex").slice(0, 16)

  // The permit's lease stops concurrent page loads from fetching the same wallets twice
  const failed = await withProviderPermit(userId, "zerion", `wallet-history:${fpHash}`, undefined, async () => {
    const settled = await Promise.allSettled(addresses.map(async (address) => {
      const points = await fetchWalletHistory(zerionKey, address)
      await storeWalletHistory(userId, normalizeWalletAddress(address), points)
    }))
    return settled
      .map((r, i) => (r.status === "rejected" ? `${addresses[i].slice(0, 10)}… (${(r.reason as Error)?.message})` : null))
      .filter((f): f is string => f !== null)
  })

  if (failed.length > 0) {
    throw new Error(`Wallet history fetch incomplete — ${failed.length} failed: ${failed.join(", ")}`)
  }
}

async function storeWalletHistory(userId: string, address: string, points: Array<[number, number]>): Promise<void> {
  // A wallet with no history still gets a row so it isn't re-fetched every load
  const rows = (points.length > 0 ? points : [[Math.floor(Date.now() / 1000), 0] as [number, number]])
    .map(([timestamp, value]) => ({ userId, address, timestamp: Math.floor(timestamp), value }))
  await db.$transaction(async (tx) => {
    await tx.walletChartCache.deleteMany({ where: { userId, address } })
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      await tx.walletChartCache.createMany({ data: rows.slice(i, i + INSERT_BATCH), skipDuplicates: true })
    }
  })
}

/** Rebuild the summed ChartCache from stored per-wallet rows (no Zerion calls). */
async function rebuildChartCache(
  userId: string,
  addresses: string[],
  walletFingerprint: string,
  nowSec: number,
): Promise<ChartPoint[]> {
  const rows = await db.walletChartCache.findMany({
    where: { userId, address: { in: addresses } },
    select: { address: true, timestamp: true, value: true },
    orderBy: { timestamp: "asc" },
    take: MAX_ROWS,
  })
  const charts = addresses.map((a) => rows.filter((r) => r.address === a).map((r): [number, number] => [r.timestamp, r.value]))
  const { valid: points } = filterValidPoints(sanitizeZerionSeries(sumWalletCharts(charts), nowSec))

  await db.$transaction(async (tx) => {
    await tx.chartCache.deleteMany({ where: { userId } })
    for (let i = 0; i < points.length; i += INSERT_BATCH) {
      await tx.chartCache.createMany({
        data: points.slice(i, i + INSERT_BATCH).map((p) => ({ userId, timestamp: p.timestamp, value: p.value })),
      })
    }
    const chartFields = JSON.stringify({
      chartWalletFingerprint: walletFingerprint,
      chartCacheUpdatedAt: new Date().toISOString(),
    })
    await tx.$executeRaw`
      INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
      VALUES (${crypto.randomUUID()}, ${userId}, ${chartFields}::jsonb)
      ON CONFLICT ("userId") DO UPDATE
      SET settings = "PortfolioSetting".settings || ${chartFields}::jsonb
    `
  })
  return points
}
