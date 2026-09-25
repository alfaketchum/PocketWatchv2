/**
 * Current per-token holdings for the "By asset" chart and its history backfill:
 * today's value per token (real positions only — fakes/dust/venues excluded)
 * and the (wallet, token) pairs worth tracking (token >= $1,000 in total,
 * >= $100 in that wallet, with a Zerion asset id).
 */

import { db } from "@/lib/db"
import { getCachedMultiProviderPositions } from "./multi-balance-cache"
import { getHiddenTokenSymbols } from "./hidden-tokens"
import { STABLECOIN_FUNGIBLE_ID_BY_SYMBOL } from "./stablecoins"
import { ASSET_BAND_MIN_USD, assetKey, canonicalPositions, isRealPosition, sumBySymbol } from "./asset-values"
import { normalizeWalletAddress } from "./utils"
import type { AssetPair } from "./wallet-chart-cache"

const PAIR_MIN_USD = 100

/** Today's per-token values and the current (wallet, token) pairs worth tracking. */
export async function currentAssetHoldings(userId: string): Promise<{ pairs: AssetPair[]; today: Map<string, number> }> {
  const wallets = await db.trackedWallet.findMany({ where: { userId }, select: { address: true, chains: true }, take: 500 })
  const [{ wallets: balances }, hidden, pnlRows] = await Promise.all([
    getCachedMultiProviderPositions(userId, wallets),
    getHiddenTokenSymbols(userId),
    db.tokenPnl.findMany({ where: { userId }, select: { walletAddress: true, symbol: true, fungibleId: true }, take: 5_000 }),
  ])
  // Canonical ids are chosen across ALL wallets, then applied per wallet
  const { idBySymbol } = canonicalPositions(balances.flatMap((w) => w.positions.filter((p) => !hidden.has(p.symbol))))
  const visible = balances.map((w) => ({
    ...w,
    positions: w.positions.filter((p) => !hidden.has(p.symbol) && isRealPosition(p)
      && (!p.fungibleId || idBySymbol.get(assetKey(p.symbol)) === p.fungibleId)),
  }))
  const today = sumBySymbol(visible.flatMap((w) => w.positions))
  const assets = [...today].filter(([, v]) => v >= ASSET_BAND_MIN_USD).sort((a, b) => b[1] - a[1]).map(([symbol]) => symbol)
  const tracked = new Set(assets)

  const pairs: AssetPair[] = []
  for (const w of visible) {
    for (const [symbol, value] of sumBySymbol(w.positions)) {
      if (!tracked.has(symbol) || value < PAIR_MIN_USD) continue
      // Zerion id: the canonical (largest) id for the symbol, else known stablecoin id, else ROI data (Solana)
      const fungibleId = idBySymbol.get(symbol)
        ?? STABLECOIN_FUNGIBLE_ID_BY_SYMBOL[symbol]
        ?? pnlRows.find((r) => r.walletAddress === normalizeWalletAddress(w.address) && assetKey(r.symbol) === symbol)?.fungibleId
      if (fungibleId) pairs.push({ address: w.address, symbol, fungibleId })
    }
  }
  return { pairs, today }
}
