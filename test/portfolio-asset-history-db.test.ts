import test from "node:test"
import assert from "node:assert/strict"
import "./setup-env"
import { db } from "@/lib/db"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"
import { parseMetadata } from "@/lib/portfolio/snapshot-helpers"

test("stored asset backfill is complete and recent snapshots include per-asset values", {
  skip: process.env.PW_ASSET_HISTORY_DB_TEST !== "1",
}, async () => {
  try {
    const pairs = await db.trackedAssetPair.findMany({
      select: { userId: true, walletAddress: true, fungibleId: true },
      take: 5_000,
    })
    assert.ok(pairs.length > 0, "No tracked assets to verify")

    const stored = await db.walletChartCache.groupBy({
      by: ["userId", "address", "series"],
      where: { series: { startsWith: "asset:" } },
    })
    const have = new Set(stored.map((r) => `${r.userId}|${r.address}|${r.series}`))
    const pending = pairs.filter((p) =>
      !have.has(`${p.userId}|${normalizeWalletAddress(p.walletAddress)}|asset:${p.fungibleId}`))
    assert.equal(pending.length, 0, `${pending.length} asset series still awaiting backfill`)

    for (const userId of new Set(pairs.map((p) => p.userId))) {
      const latest = await db.portfolioSnapshot.findFirst({
        where: { userId, source: "live_refresh" },
        orderBy: { createdAt: "desc" },
        select: { metadata: true },
      })
      const values = parseMetadata(latest?.metadata)?.assetValues
      assert.ok(values && typeof values === "object" && Object.keys(values).length > 0,
        "Latest refresh snapshot is missing per-asset values")
    }
  } finally {
    await db.$disconnect()
  }
})
