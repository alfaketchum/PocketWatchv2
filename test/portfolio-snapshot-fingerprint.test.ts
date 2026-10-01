import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import "./setup-env"
import { buildWalletFingerprint } from "@/lib/portfolio/snapshot-helpers"
import { matchesSnapshotWallets, snapshotsForWallets } from "@/lib/portfolio/snapshot-fingerprint"
import { buildSnapshotPoints, refreshZerionCache } from "@/lib/portfolio/snapshot-data-pipeline"

const wallets = ["0xBBB", "0xaaa"]
const fingerprint = buildWalletFingerprint(wallets)
const legacyHash = (addresses: string[]) => createHash("sha256")
  .update(addresses.map((a) => a.toLowerCase()).sort().join("|"))
  .digest("hex").slice(0, 16)
const nowSec = Math.floor(Date.now() / 1000)

function snapshot(id: string, value: number, walletFingerprint: string) {
  return {
    id, createdAt: new Date((nowSec - 60) * 1000), totalValue: value,
    source: "live_refresh", metadata: JSON.stringify({ walletFingerprint }),
  }
}

test("refresh and history use the same wallet fingerprint; old hashes remain readable", () => {
  assert.equal(matchesSnapshotWallets({ walletFingerprint: fingerprint }, fingerprint), true)
  assert.equal(matchesSnapshotWallets({ walletFingerprint: legacyHash(wallets) }, fingerprint), true)
  assert.equal(matchesSnapshotWallets({ walletFingerprint: legacyHash(["0xaaa"]) }, fingerprint), false)
  assert.equal(matchesSnapshotWallets({ walletFingerprint: buildWalletFingerprint(["0xaaa"]) }, fingerprint), false)
})

test("history includes current and legacy refresh snapshots, not another wallet set", () => {
  const snapshots = [
    snapshot("complete", 100, fingerprint),
    snapshot("legacy-partial", 92, legacyHash(wallets)),
    snapshot("removed-wallet", 110, legacyHash(["0xaaa"])),
  ]
  const points = buildSnapshotPoints({
    snapshots, effectiveScope: "onchain", walletFingerprint: fingerprint,
    nowSec, cachedChartRows: [], zerionPoints: [],
  })
  assert.deepEqual(points.map((p) => p.value), [100, 92])
})

test("adding a wallet excludes old-set snapshots so stored wallet histories can backfill past days", () => {
  const oldSet = buildWalletFingerprint(["0xaaa"])
  const rows = [
    snapshot("before-added", 100, legacyHash(["0xaaa"])),
    snapshot("after-added", 190, fingerprint),
  ]
  assert.deepEqual(snapshotsForWallets(rows, fingerprint).map((r) => r.id), ["after-added"])
  assert.deepEqual(snapshotsForWallets(rows, oldSet).map((r) => r.id), ["before-added"])
})

test("an in-flight rebuild never serves chart points for a removed wallet", async () => {
  const userId = "wallet-set-change-test"
  const shared = globalThis as typeof globalThis & { __pwChartSyncRunning?: Set<string> }
  const running = (shared.__pwChartSyncRunning ??= new Set())
  running.add(userId)
  const zerionPoints = [{ timestamp: nowSec - 300, value: 100, source: "zerion" }]
  const params = {
    userId, zerionKey: null, addresses: wallets, nowSec, zerionPoints,
    previousFingerprint: buildWalletFingerprint(["0xaaa"]),
    walletFingerprint: fingerprint, staleReconstructedSnapshotIds: [],
    futureRows: [],
  }
  try {
    assert.deepEqual(await refreshZerionCache(params), [])
    assert.deepEqual(await refreshZerionCache({
      ...params, previousFingerprint: fingerprint,
    }), zerionPoints)
  } finally {
    running.delete(userId)
  }
})
