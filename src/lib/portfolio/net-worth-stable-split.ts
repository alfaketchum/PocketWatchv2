/**
 * Historical Stablecoins vs Digital Assets split for net worth.
 *
 * Per day, stablecoins (USDC/USDT/USDe/USDG) come from, in priority order:
 *   1. a live snapshot recorded with the same stablecoin definition, else
 *   2. the stored stablecoin-only Zerion history (forward-filled) + Hyperliquid /
 *      Lighter value (venue equity is USDC collateral and settles in USDC).
 * Digital assets = crypto total − stablecoins.
 */

import { db } from "@/lib/db"
import { parseMetadata } from "./snapshot-helpers"
import { STABLECOIN_SET_VERSION } from "./stablecoins"

const MAX_ROWS = 20_000

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Returns a per-day stablecoin lookup — call it for days in ascending order
 * (it forward-fills). Null when no stablecoin history exists yet, so the caller
 * can fall back to the live ratio instead of showing everything as digital.
 */
export async function loadStablecoinSplit(
  userId: string,
  since: Date,
): Promise<((day: string, crypto: number, venues: number) => number) | null> {
  const [chartRows, snapshots] = await Promise.all([
    db.stablecoinChartCache.findMany({
      where: { userId, timestamp: { gte: Math.floor(since.getTime() / 1000) } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, value: true },
      take: MAX_ROWS,
    }),
    db.portfolioSnapshot.findMany({
      where: { userId, source: "live_refresh", createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, metadata: true },
      take: MAX_ROWS,
    }),
  ])
  const hasHistory = chartRows.length > 0 || await db.stablecoinChartCache.count({ where: { userId } }) > 0
  if (!hasHistory) return null

  const chartByDay = new Map(chartRows.map((r) => [dayKey(r.timestamp * 1000), r.value]))
  const snapshotByDay = new Map<string, number>()
  for (const s of snapshots) {
    const meta = parseMetadata(s.metadata)
    if (meta?.stablecoinSet === STABLECOIN_SET_VERSION && typeof meta.stablecoinValue === "number") {
      snapshotByDay.set(dayKey(s.createdAt.getTime()), meta.stablecoinValue)
    }
  }

  let lastChart = 0
  return (day, crypto, venues) => {
    lastChart = chartByDay.get(day) ?? lastChart
    const stable = snapshotByDay.get(day) ?? lastChart + venues
    return Math.min(Math.max(stable, 0), Math.max(crypto, 0))
  }
}
