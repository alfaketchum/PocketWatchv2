/**
 * Background job behind the portfolio "By asset" chart:
 *   1. register current (wallet, token) holdings as tracked pairs (kept forever,
 *      so a sold token's band doesn't disappear),
 *   2. weekly: discover past tokens from transaction history (Zerion lookups)
 *      and rebuild dead tokens' history from transactions (no API calls),
 *   3. fetch Zerion history for tracked pairs that lack it (budget-capped).
 * Never throws; safe to trigger on every By-asset load (no-op when current).
 */

import { db } from "@/lib/db"
import { getServiceKey } from "./service-keys"
import { discoverHistoricalAssets } from "./asset-discovery"
import { rebuildDeadTokenHistory } from "./dead-token-history"
import { ensureAssetSeries, type AssetPair } from "./wallet-chart-cache"
import { normalizeWalletAddress } from "./utils"
import { runAsBackgroundZerion } from "./zerion-request-meter"
import { currentAssetHoldings } from "./asset-pairs"

const DISCOVERY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

const g = globalThis as unknown as { __pwAssetJobRunning?: Set<string> }
const running = (g.__pwAssetJobRunning ??= new Set())

async function discoveryDue(userId: string): Promise<boolean> {
  const row = await db.portfolioSetting.findUnique({ where: { userId }, select: { settings: true } })
  const at = (row?.settings as { assetDiscoveryAt?: string } | null)?.assetDiscoveryAt
  return !at || Date.now() - Date.parse(at) >= DISCOVERY_INTERVAL_MS
}

async function markDiscovered(userId: string): Promise<void> {
  const json = JSON.stringify({ assetDiscoveryAt: new Date().toISOString() })
  await db.$executeRaw`
    INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
    VALUES (${crypto.randomUUID()}, ${userId}, ${json}::jsonb)
    ON CONFLICT ("userId") DO UPDATE
    SET settings = "PortfolioSetting".settings || ${json}::jsonb
  `
}

/** Every tracked pair (current + past holdings). */
export async function loadTrackedPairs(userId: string): Promise<AssetPair[]> {
  const rows = await db.trackedAssetPair.findMany({
    where: { userId },
    select: { walletAddress: true, fungibleId: true, symbol: true },
    take: 5_000,
  })
  return rows.map((r) => ({ address: r.walletAddress, fungibleId: r.fungibleId, symbol: r.symbol }))
}

/**
 * Tracked pairs in fetch-priority order: current holdings first, then past
 * holdings by their largest transfer in that wallet — so big positions (AIXBT,
 * REI…) aren't stuck behind dust while the daily budget is spent.
 */
async function loadPairsByPriority(userId: string): Promise<AssetPair[]> {
  const rows = await db.$queryRaw<Array<{ walletAddress: string; fungibleId: string; symbol: string }>>`
    SELECT p."walletAddress", p."fungibleId", p.symbol
    FROM "TrackedAssetPair" p
    LEFT JOIN "AssetCandidate" c ON c."userId" = p."userId" AND c."fungibleId" = p."fungibleId"
    LEFT JOIN "TransactionCache" t ON t."userId" = p."userId" AND t.chain = c.chain
      AND lower(t.asset) = lower(c.contract) AND lower(t."walletAddress") = lower(p."walletAddress")
      AND t."usdValue" <= 50000000
    WHERE p."userId" = ${userId}
    GROUP BY p."walletAddress", p."fungibleId", p.symbol, p.source
    ORDER BY (p.source = 'current') DESC, COALESCE(MAX(t."usdValue"), 0) DESC
    LIMIT 5000
  `
  return rows.map((r) => ({ address: r.walletAddress, fungibleId: r.fungibleId, symbol: r.symbol }))
}

export async function runAssetHistoryJob(userId: string): Promise<void> {
  if (running.has(userId)) return
  running.add(userId)
  try {
    await runAsBackgroundZerion(async () => runJob(userId, (await currentAssetHoldings(userId)).pairs))
  } catch (err) {
    console.warn("[asset-history] job failed:", (err as Error).message)
  } finally {
    running.delete(userId)
  }
}

async function runJob(userId: string, currentPairs: AssetPair[]): Promise<void> {
  await db.trackedAssetPair.createMany({
    data: currentPairs.map((p) => ({
      userId, walletAddress: normalizeWalletAddress(p.address), fungibleId: p.fungibleId, symbol: p.symbol, source: "current",
    })),
    skipDuplicates: true,
  })

  const zerionKey = await getServiceKey(userId, "zerion")
  if (zerionKey && await discoveryDue(userId)) {
    const found = await discoverHistoricalAssets(userId, zerionKey)
    const rebuilt = await rebuildDeadTokenHistory(userId)
    await markDiscovered(userId)
    console.info(`[asset-history] discovery: ${found.priced} priced, ${found.dead} dead → ${rebuilt.stored} rebuilt, ${rebuilt.rejected} rejected`)
  }

  const fetched = await ensureAssetSeries(userId, await loadPairsByPriority(userId))
  if (fetched > 0) console.info(`[asset-history] fetched history for ${fetched} pair(s)`)
}
