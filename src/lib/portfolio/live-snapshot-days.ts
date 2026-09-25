import { db } from "@/lib/db"
import { snapshotSupplementalValue } from "./supplemental-history"

const MAX_SNAPSHOTS = 20_000

/**
 * Crypto value per UTC day ("YYYY-MM-DD") from live_refresh snapshots — last
 * snapshot of each day wins — EXCLUDING Hyperliquid/Lighter (older snapshots
 * predate them; callers add the supplemental series back for every day). These
 * are the source for recent days; the Zerion chart is only fetched once per
 * wallet and covers the history before tracking began.
 */
export async function loadLiveSnapshotByDay(userId: string, since: Date): Promise<Map<string, number>> {
  const rows = await db.portfolioSnapshot.findMany({
    where: { userId, source: "live_refresh", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, totalValue: true, metadata: true },
    take: MAX_SNAPSHOTS,
  })
  return new Map(rows.map((r) => [
    r.createdAt.toISOString().slice(0, 10),
    r.totalValue - snapshotSupplementalValue(r.metadata),
  ]))
}
