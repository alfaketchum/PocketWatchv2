/**
 * Per-wallet Zerion history, fetched ONCE per wallet and kept (WalletChartCache).
 *
 * Past values don't change, so there is no periodic re-fetch: recent days come
 * from live_refresh snapshots, which the chart already prefers per day. Zerion is
 * only called for wallets with no stored history yet (a newly added wallet, or
 * everything after a forced rebuild) — 2 requests per wallet per series.
 *
 * Two series per wallet:
 *   "total"      → summed into ChartCache (the value history)
 *   "stablecoin" → USDC/USDT/USDe/USDG only, summed into StablecoinChartCache
 *                  (the historical Stablecoins vs Digital Assets split)
 * Summed caches are rebuilt from the stored rows with zero Zerion calls.
 */

import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { fetchWalletHistory, sumWalletCharts } from "./zerion-client"
import { withProviderPermit } from "./provider-governor"
import { filterValidPoints } from "./snapshot-validation"
import { normalizeWalletAddress } from "./utils"
import { buildWalletFingerprint, sanitizeZerionSeries, type ChartPoint } from "./snapshot-helpers"
import { getServiceKey } from "./service-keys"
import { NET_WORTH_STABLECOIN_FUNGIBLE_IDS } from "./stablecoins"

const MAX_ROWS = 200_000
const INSERT_BATCH = 1_000

type Series = "total" | "stablecoin"
const SERIES_FILTER: Record<Series, string[] | undefined> = {
  total: undefined,
  stablecoin: NET_WORTH_STABLECOIN_FUNGIBLE_IDS,
}

// ─── Shared: keep per-wallet rows in sync with the wallet set ───

/**
 * Drop rows for removed wallets and fetch history for wallets that have none.
 * Returns whether the stored set changed. Throws if any fetch failed (successful
 * wallets are still stored), so callers don't build a sum with a wallet missing.
 */
async function syncSeriesRows(
  userId: string,
  zerionKey: string | null,
  addresses: string[],
  series: Series,
  walletFingerprint: string,
): Promise<boolean> {
  const byNormalized = new Map(addresses.map((a) => [normalizeWalletAddress(a), a]))
  const stored = await db.walletChartCache.groupBy({ by: ["address"], where: { userId, series } })
  const storedSet = new Set(stored.map((r) => r.address))
  const removed = [...storedSet].filter((a) => !byNormalized.has(a))
  const missing = [...byNormalized.keys()].filter((a) => !storedSet.has(a))

  if (removed.length > 0) {
    await db.walletChartCache.deleteMany({ where: { userId, series, address: { in: removed } } })
  }
  if (missing.length > 0) {
    await fetchMissingWallets(userId, zerionKey, missing.map((a) => byNormalized.get(a)!), series, walletFingerprint)
  }
  return removed.length > 0 || missing.length > 0
}

async function fetchMissingWallets(
  userId: string,
  zerionKey: string | null,
  addresses: string[],
  series: Series,
  walletFingerprint: string,
): Promise<void> {
  if (!zerionKey) throw new Error(`No Zerion key — ${addresses.length} wallet(s) have no ${series} history`)
  const fpHash = createHash("sha256").update(walletFingerprint).digest("hex").slice(0, 16)

  // The permit's lease stops concurrent page loads from fetching the same wallets twice
  const failed = await withProviderPermit(userId, "zerion", `wallet-history:${series}:${fpHash}`, undefined, async () => {
    const settled = await Promise.allSettled(addresses.map(async (address) => {
      const points = await fetchWalletHistory(zerionKey, address, SERIES_FILTER[series])
      await storeWalletHistory(userId, normalizeWalletAddress(address), series, points)
    }))
    return settled
      .map((r, i) => (r.status === "rejected" ? `${addresses[i].slice(0, 10)}… (${(r.reason as Error)?.message})` : null))
      .filter((f): f is string => f !== null)
  })

  if (failed.length > 0) {
    throw new Error(`Wallet ${series} history fetch incomplete — ${failed.length} failed: ${failed.join(", ")}`)
  }
}

async function storeWalletHistory(userId: string, address: string, series: Series, points: Array<[number, number]>): Promise<void> {
  // A wallet with no history still gets a row so it isn't re-fetched every load
  const rows = (points.length > 0 ? points : [[Math.floor(Date.now() / 1000), 0] as [number, number]])
    .map(([timestamp, value]) => ({ userId, address, series, timestamp: Math.floor(timestamp), value }))
  await db.$transaction(async (tx) => {
    await tx.walletChartCache.deleteMany({ where: { userId, address, series } })
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      await tx.walletChartCache.createMany({ data: rows.slice(i, i + INSERT_BATCH), skipDuplicates: true })
    }
  })
}

async function sumStoredSeries(userId: string, addresses: string[], series: Series): Promise<[number, number][]> {
  const normalized = addresses.map(normalizeWalletAddress)
  const rows = await db.walletChartCache.findMany({
    where: { userId, series, address: { in: normalized } },
    select: { address: true, timestamp: true, value: true },
    orderBy: { timestamp: "asc" },
    take: MAX_ROWS,
  })
  return sumWalletCharts(normalized.map((a) => rows.filter((r) => r.address === a).map((r): [number, number] => [r.timestamp, r.value])))
}

async function mergeSettings(tx: Pick<typeof db, "$executeRaw">, userId: string, fields: Record<string, string>): Promise<void> {
  const json = JSON.stringify(fields)
  await tx.$executeRaw`
    INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
    VALUES (${crypto.randomUUID()}, ${userId}, ${json}::jsonb)
    ON CONFLICT ("userId") DO UPDATE
    SET settings = "PortfolioSetting".settings || ${json}::jsonb
  `
}

// ─── Total value history → ChartCache ───

interface SyncParams {
  userId: string
  zerionKey: string | null
  addresses: string[]
  walletFingerprint: string
  /** settings.chartWalletFingerprint — the wallet set ChartCache was built for */
  previousFingerprint: string
  hasChartCache: boolean
  nowSec: number
  /** Drop all stored history (both series) and re-fetch every wallet (manual rebuild only). */
  force?: boolean
}

/** Returns the rebuilt summed series, or null when ChartCache is already current. */
export async function syncWalletCharts(params: SyncParams): Promise<ChartPoint[] | null> {
  const { userId, zerionKey, addresses, walletFingerprint, previousFingerprint, hasChartCache, nowSec, force } = params
  if (force) {
    await db.walletChartCache.deleteMany({ where: { userId } })
    await db.stablecoinChartCache.deleteMany({ where: { userId } })
  }

  const changed = await syncSeriesRows(userId, zerionKey, addresses, "total", walletFingerprint)
  if (!force && !changed && hasChartCache && previousFingerprint === walletFingerprint) return null

  const { valid: points } = filterValidPoints(sanitizeZerionSeries(await sumStoredSeries(userId, addresses, "total"), nowSec))
  await db.$transaction(async (tx) => {
    await tx.chartCache.deleteMany({ where: { userId } })
    for (let i = 0; i < points.length; i += INSERT_BATCH) {
      await tx.chartCache.createMany({
        data: points.slice(i, i + INSERT_BATCH).map((p) => ({ userId, timestamp: p.timestamp, value: p.value })),
      })
    }
    await mergeSettings(tx, userId, { chartWalletFingerprint: walletFingerprint, chartCacheUpdatedAt: new Date().toISOString() })
  })
  return points
}

// ─── Stablecoin history → StablecoinChartCache ───

const g = globalThis as unknown as { __pwStableSyncRunning?: Set<string> }
const stableRunning = (g.__pwStableSyncRunning ??= new Set())

/**
 * Make sure the stablecoin-only history exists for the current wallet set.
 * Cheap when current (two small queries); fetches only wallets missing it.
 * Never throws — the net-worth split falls back until it succeeds.
 */
export async function syncStablecoinCharts(userId: string): Promise<void> {
  if (stableRunning.has(userId)) return
  stableRunning.add(userId)
  try {
    const wallets = await db.trackedWallet.findMany({ where: { userId }, select: { address: true }, take: 500 })
    const addresses = wallets.map((w) => w.address)
    if (addresses.length === 0) return
    const walletFingerprint = buildWalletFingerprint(addresses)

    const [settings, cached] = await Promise.all([
      db.portfolioSetting.findUnique({ where: { userId }, select: { settings: true } }),
      db.stablecoinChartCache.count({ where: { userId } }),
    ])
    const previous = (settings?.settings as { stablecoinChartFingerprint?: string } | null)?.stablecoinChartFingerprint
    const zerionKey = await getServiceKey(userId, "zerion")

    const changed = await syncSeriesRows(userId, zerionKey, addresses, "stablecoin", walletFingerprint)
    if (!changed && cached > 0 && previous === walletFingerprint) return

    const points = (await sumStoredSeries(userId, addresses, "stablecoin")).filter(([, v]) => Number.isFinite(v) && v >= 0)
    await db.$transaction(async (tx) => {
      await tx.stablecoinChartCache.deleteMany({ where: { userId } })
      for (let i = 0; i < points.length; i += INSERT_BATCH) {
        await tx.stablecoinChartCache.createMany({
          data: points.slice(i, i + INSERT_BATCH).map(([timestamp, value]) => ({ userId, timestamp, value })),
        })
      }
      await mergeSettings(tx, userId, { stablecoinChartFingerprint: walletFingerprint })
    })
    console.info(`[stablecoin-history] rebuilt ${points.length} points for ${addresses.length} wallet(s)`)
  } catch (err) {
    console.warn("[stablecoin-history] sync failed:", (err as Error).message)
  } finally {
    stableRunning.delete(userId)
  }
}
