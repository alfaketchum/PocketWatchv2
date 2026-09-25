import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { buildWalletFingerprint } from "@/lib/portfolio/snapshot-helpers"
import { refreshZerionCache } from "@/lib/portfolio/snapshot-data-pipeline"
import { backfillSupplementalHistory } from "@/lib/portfolio/supplemental-backfill"
import { repairSolanaInSnapshots } from "@/lib/portfolio/snapshot-solana-repair"

export const maxDuration = 120

/**
 * POST /api/portfolio/maintenance/rebuild-history
 * Backfill Hyperliquid/Lighter daily history, add the missing Solana value to
 * live snapshots written while Helius balances were broken, and re-fetch every
 * wallet's Zerion history (the summed chart is only rebuilt once all succeed).
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9120", "Authentication required", 401)

  try {
    const [supplementalRows, zerionKey, wallets] = await Promise.all([
      backfillSupplementalHistory(user.id),
      getServiceKey(user.id, "zerion"),
      db.trackedWallet.findMany({ where: { userId: user.id }, select: { address: true }, take: 500 }),
    ])

    const addresses = wallets.map((w) => w.address)
    const walletFingerprint = buildWalletFingerprint(addresses)
    const chartPoints = await refreshZerionCache({
      userId: user.id,
      zerionKey,
      addresses,
      zerionPoints: [],
      nowSec: Math.floor(Date.now() / 1000),
      previousFingerprint: walletFingerprint,
      walletFingerprint,
      staleReconstructedSnapshotIds: [],
      futureRows: [],
      force: true, // re-fetch every wallet's history (2 Zerion requests per wallet)
    })

    const solanaSnapshotsRepaired = zerionKey ? await repairSolanaInSnapshots(user.id, zerionKey) : 0

    return NextResponse.json({
      supplementalRows,
      solanaSnapshotsRepaired,
      chartRebuilt: chartPoints.length > 0,
      chartPoints: chartPoints.length,
    })
  } catch (error) {
    return apiError("E9121", "Failed to rebuild history", 500, error)
  }
}
