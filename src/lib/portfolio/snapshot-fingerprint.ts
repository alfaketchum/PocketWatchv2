import { createHash } from "node:crypto"
import { getSnapshotWalletFingerprint } from "./snapshot-helpers"

/** Old refresh jobs wrote a short hash instead of the chart's wallet-set fingerprint. */
export function matchesSnapshotWallets(metadata: unknown, walletFingerprint: string): boolean {
  const stored = getSnapshotWalletFingerprint(metadata)
  if (!stored) return false
  if (stored === walletFingerprint) return true

  const legacy = createHash("sha256")
    .update(walletFingerprint.split("|").map((a) => a.toLowerCase()).sort().join("|"))
    .digest("hex")
    .slice(0, 16)
  return stored === legacy
}

export function snapshotsForWallets<T extends { metadata: unknown }>(
  snapshots: T[],
  walletFingerprint: string,
): T[] {
  return snapshots.filter((snapshot) => matchesSnapshotWallets(snapshot.metadata, walletFingerprint))
}
