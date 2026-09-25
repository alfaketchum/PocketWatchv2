/**
 * One-shot repair of live_refresh snapshots written while the Helius balance client
 * was broken (it silently returned $0 for every Solana wallet). For each such row,
 * the Solana value at that time is taken from Zerion's per-wallet chart and added
 * to totalValue / onchainTotalValue / chainDistribution.solana.
 */

import { db } from "@/lib/db"
import { fetchWalletChart } from "./zerion-client"
import { parseMetadata } from "./snapshot-helpers"

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_SNAPSHOTS = 5_000

function valueAt(series: Array<[number, number]>, tsSec: number): number {
  let value = 0
  for (const [t, v] of series) {
    if (t > tsSec) break
    value = v
  }
  return value
}

/** Returns how many snapshot rows were corrected. */
export async function repairSolanaInSnapshots(userId: string, zerionKey: string): Promise<number> {
  const wallets = await db.trackedWallet.findMany({ where: { userId }, select: { address: true }, take: 500 })
  const solAddresses = wallets.map((w) => w.address).filter((a) => !a.startsWith("0x") && SOLANA_ADDRESS.test(a))
  if (solAddresses.length === 0) return 0

  // "month" is fine-grained and covers the affected window (live rows are recent)
  const charts = await Promise.all(solAddresses.map(async (a) =>
    [...await fetchWalletChart(zerionKey, a, "month")].sort((x, y) => x[0] - y[0])))
  const earliestSec = Math.max(...charts.map((c) => c[0]?.[0] ?? Number.POSITIVE_INFINITY))
  if (!Number.isFinite(earliestSec)) return 0

  const rows = await db.portfolioSnapshot.findMany({
    where: { userId, source: "live_refresh", createdAt: { gte: new Date(earliestSec * 1000) } },
    select: { id: true, createdAt: true, totalValue: true, metadata: true },
    take: MAX_SNAPSHOTS,
  })

  let repaired = 0
  for (const row of rows) {
    const meta = parseMetadata(row.metadata) ?? {}
    const distribution = (meta.chainDistribution ?? {}) as Record<string, number>
    if ((distribution.solana ?? 0) > 0) continue

    const tsSec = Math.floor(row.createdAt.getTime() / 1000)
    const solana = charts.reduce((s, c) => s + valueAt(c, tsSec), 0)
    if (solana <= 0) continue

    const onchain = typeof meta.onchainTotalValue === "number" ? meta.onchainTotalValue + solana : undefined
    await db.portfolioSnapshot.update({
      where: { id: row.id },
      data: {
        totalValue: row.totalValue + solana,
        metadata: JSON.stringify({
          ...meta,
          chainDistribution: { ...distribution, solana },
          ...(onchain !== undefined ? { onchainTotalValue: onchain } : {}),
          solanaRepaired: true,
        }),
      },
    })
    repaired++
  }
  return repaired
}
