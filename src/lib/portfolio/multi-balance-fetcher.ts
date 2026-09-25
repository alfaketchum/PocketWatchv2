/**
 * Balance fetcher orchestrator.
 *
 * Splits wallets by chain type and dispatches to the right provider.
 *
 * EVM:    Zerion only (complete data incl. DeFi; no worse-data fallback)
 * Solana: Helius → Alchemy
 * BTC:    skipped (no dedicated provider wired yet)
 * Hyperliquid / Lighter: merged into each EVM wallet (same address)
 */

import { createHash } from "node:crypto"
import { getServiceKey } from "./service-keys"
import { withProviderPermit, withProviderPermitCounted } from "./provider-governor"
import { fetchMultiWalletPositions, type MultiWalletResult, type ZerionWalletData } from "./zerion-client"
import { fetchMultiHeliusBalances } from "./helius-balance-client"
import { fetchMultiAlchemyBalances } from "./alchemy-balance-client"
import { fetchMultiMovementBalances } from "./movement-balance-client"
import { fetchVenuePositions, mergeVenuePositions } from "./venue-balances"

// Chains treated as EVM — fetched from Zerion.
// Includes both DB format (uppercase short codes) and Zerion format (lowercase full names).
const EVM_CHAINS = new Set([
  // DB format (TrackedWallet.chains)
  "ETH", "ARBITRUM_ONE", "BASE", "POLYGON_POS", "BSC", "OPTIMISM",
  "LINEA", "SCROLL", "ZKSYNC", "AVAX", "GNOSIS", "BLAST", "MANTLE",
  "MODE", "FANTOM", "ZORA", "BERACHAIN", "MONAD",
  // Zerion format (lowercase)
  "ethereum", "arbitrum", "base", "polygon", "binance-smart-chain",
  "optimism", "linea", "scroll", "zksync-era",
])

const SOLANA_CHAINS = new Set(["solana", "SOL"])
const BTC_CHAINS = new Set(["btc", "BTC"])
// Movement (Aptos/Move L2) — custom fetcher, no Zerion/Alchemy coverage.
const MOVEMENT_CHAINS = new Set(["movement", "MOVEMENT", "MOVE"])

interface WalletInput {
  address: string
  chains: string[]
}

/** Short hash of wallet addresses for operation key (must fit in btree index). */
function walletFingerprint(addresses: string[]): string {
  const sorted = addresses.map((a) => a.toLowerCase()).sort().join("|")
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16)
}

/**
 * Fetch EVM balances from Zerion — the single source of truth for EVM.
 *
 * Zerion returns complete data including DeFi positions (staked/locked/rewards),
 * which the fallback providers (Alchemy/Moralis) do not. Falling back to them
 * produced fresh-but-wrong totals ("reading the Alchemy pull"), so the balance
 * path was simplified back to the original Zerion-only design: when Zerion is
 * rate-limited this throws, and the caller serves the last good snapshot
 * (correct-but-stale) instead of degrading to a provider that drops DeFi value.
 */
async function fetchEvmBalances(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  if (wallets.length === 0) return { wallets: [], failedCount: 0 }

  const addresses = wallets.map((w) => w.address)
  const zerionKey = await getServiceKey(userId, "zerion")
  if (!zerionKey) {
    console.warn(`[multi-fetch] No Zerion key — cannot fetch ${wallets.length} EVM wallet(s)`)
    return { wallets: [], failedCount: wallets.length }
  }

  return withProviderPermitCounted(
    userId, "zerion", `evm-positions:${walletFingerprint(addresses)}`, undefined,
    async () => {
      const r = await fetchMultiWalletPositions(zerionKey, addresses)
      // One Zerion HTTP request per attempted wallet — count them so the daily
      // budget reflects the real fan-out, not one call per batch.
      return { value: r, calls: r.requestCount ?? addresses.length, rateLimited: r.rateLimitedCount ?? 0 }
    },
  )
}

/**
 * Fetch Solana balances with waterfall fallback: Helius → Alchemy.
 */
async function fetchSolanaBalances(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  if (wallets.length === 0) return { wallets: [], failedCount: 0 }

  const addresses = wallets.map((w) => w.address)

  // ─── Try Helius (primary) ───
  const heliusKey = await getServiceKey(userId, "helius")
  if (heliusKey) {
    try {
      return await withProviderPermit(
        userId, "helius", `sol-balances`, undefined,
        () => fetchMultiHeliusBalances(heliusKey, addresses),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Helius failed for Solana (${reason}) — trying Alchemy fallback`)
    }
  }

  // ─── Try Alchemy (fallback — supports Solana) ───
  const alchemyKey = await getServiceKey(userId, "alchemy")
  if (alchemyKey) {
    try {
      const solWallets = wallets.map((w) => ({ address: w.address, chains: ["SOL"] }))
      return await withProviderPermit(
        userId, "alchemy", `sol-balances`, undefined,
        () => fetchMultiAlchemyBalances(alchemyKey, solWallets),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Alchemy failed for Solana (${reason}) — all Solana providers exhausted`)
    }
  }

  console.warn(`[multi-fetch] No Solana provider available for ${wallets.length} wallets`)
  return { wallets: [], failedCount: wallets.length }
}

/** Fetch Movement balances (wallet tokens + Yuzu LP) via the custom client. */
async function fetchMovementBalancesDispatch(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  if (wallets.length === 0) return { wallets: [], failedCount: 0 }
  const addresses = wallets.map((w) => w.address)
  try {
    return await withProviderPermit(
      userId, "movement", `movement-balances`, undefined,
      () => fetchMultiMovementBalances(addresses),
    )
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn(`[multi-fetch] Movement fetch failed (${reason})`)
    return { wallets: [], failedCount: wallets.length }
  }
}

/**
 * Fetch balances for all wallets across all chain types.
 *
 * Splits wallets by chain type (EVM vs Solana vs Movement), dispatches to the
 * right provider, merges results, and returns unified MultiWalletResult.
 */
export async function fetchAllWalletBalances(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  // Split wallets by chain type
  const evmWallets: WalletInput[] = []
  const solanaWallets: WalletInput[] = []
  const movementWallets: WalletInput[] = []

  for (const w of wallets) {
    const hasEvm = w.chains.some((c) => EVM_CHAINS.has(c))
    const hasSolana = w.chains.some((c) => SOLANA_CHAINS.has(c))
    const hasMovement = w.chains.some((c) => MOVEMENT_CHAINS.has(c))

    if (hasEvm) evmWallets.push(w)
    if (hasSolana) solanaWallets.push(w)
    if (hasMovement) movementWallets.push(w)
    // BTC wallets are skipped for now
  }

  console.log(
    `[multi-fetch] Dispatching: ${evmWallets.length} EVM, ${solanaWallets.length} Solana, ${movementWallets.length} Movement` +
    ` (${wallets.length - evmWallets.length - solanaWallets.length - movementWallets.length} skipped)`,
  )

  // Fetch each chain type in parallel — allSettled so one failing doesn't kill the others
  // Hyperliquid/Lighter accounts are keyed by the same EVM addresses (never throws)
  const venuePromise = fetchVenuePositions(evmWallets.map((w) => w.address))
  const [evmSettled, solanaSettled, movementSettled] = await Promise.allSettled([
    fetchEvmBalances(userId, evmWallets),
    fetchSolanaBalances(userId, solanaWallets),
    fetchMovementBalancesDispatch(userId, movementWallets),
  ])
  const venuePositions = await venuePromise

  const evmResult = evmSettled.status === "fulfilled"
    ? { ...evmSettled.value, wallets: mergeVenuePositions(evmSettled.value.wallets, venuePositions) }
    : { wallets: [] as ZerionWalletData[], failedCount: evmWallets.length }
  const solanaResult = solanaSettled.status === "fulfilled"
    ? solanaSettled.value
    : { wallets: [] as ZerionWalletData[], failedCount: solanaWallets.length }
  const movementResult = movementSettled.status === "fulfilled"
    ? movementSettled.value
    : { wallets: [] as ZerionWalletData[], failedCount: movementWallets.length }

  if (evmSettled.status === "rejected") {
    console.warn(`[multi-fetch] EVM fetch failed: ${evmSettled.reason?.message ?? "unknown"}`)
  }
  if (solanaSettled.status === "rejected") {
    console.warn(`[multi-fetch] Solana fetch failed: ${solanaSettled.reason?.message ?? "unknown"}`)
  }
  if (movementSettled.status === "rejected") {
    console.warn(`[multi-fetch] Movement fetch failed: ${movementSettled.reason?.message ?? "unknown"}`)
  }

  // Merge results
  const mergedWallets: ZerionWalletData[] = [...evmResult.wallets, ...solanaResult.wallets, ...movementResult.wallets]
  const totalFailed = evmResult.failedCount + solanaResult.failedCount + movementResult.failedCount

  const totalPositions = mergedWallets.reduce((s, w) => s + w.positions.length, 0)
  console.log(
    `[multi-fetch] Complete: ${mergedWallets.length} wallets, ${totalPositions} positions, ${totalFailed} failed`,
  )

  if (mergedWallets.length === 0 && wallets.length > 0) {
    throw new Error(`All ${wallets.length} wallet fetches failed across all providers`)
  }

  return { wallets: mergedWallets, failedCount: totalFailed }
}
