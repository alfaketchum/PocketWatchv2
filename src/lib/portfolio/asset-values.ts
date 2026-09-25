/**
 * Per-token values for the portfolio "By asset" chart. Tokens are keyed by
 * uppercase symbol (USDC on every chain is one asset). Hyperliquid / Lighter
 * positions are excluded — the chart shows them as their own band.
 */

import { SUPPLEMENTAL_SOURCES } from "./supplemental-history"
import { isLikelySpamTokenSymbol } from "./price-symbol-utils"

interface AssetPosition { symbol: string; value: number; chain: string; fungibleId?: string | null }

/** A token gets its own chart band at or above this total value (today) */
export const ASSET_BAND_MIN_USD = 1_000
/** Per-token values recorded on snapshots at or above this (bounds metadata size) */
const SNAPSHOT_ASSET_MIN_USD = 100

const VENUE_CHAINS = new Set<string>(SUPPLEMENTAL_SOURCES)

export function assetKey(symbol: string): string {
  return symbol.trim().toUpperCase()
}

/**
 * Keep only real positions for per-token grouping. Fake tokens often reuse a real
 * symbol (a scam "USDC"), so for each symbol only the Zerion asset id holding the
 * most value counts; other same-symbol ids, spam-looking symbols, and venue
 * positions are dropped (they still count toward totals, i.e. Misc). Positions
 * without a Zerion id (Solana via Helius) are kept.
 */
/** Positive value, not a Hyperliquid/Lighter position, not a spam-looking symbol. */
export function isRealPosition(p: AssetPosition): boolean {
  return p.value > 0 && !VENUE_CHAINS.has(p.chain) && !isLikelySpamTokenSymbol(p.symbol)
}

export function canonicalPositions<T extends AssetPosition>(positions: T[]): { positions: T[]; idBySymbol: Map<string, string> } {
  const real = positions.filter(isRealPosition)
  const valueById = new Map<string, { symbol: string; value: number }>()
  for (const p of real) {
    if (!p.fungibleId) continue
    const prev = valueById.get(p.fungibleId)
    valueById.set(p.fungibleId, { symbol: assetKey(p.symbol), value: (prev?.value ?? 0) + p.value })
  }
  const idBySymbol = new Map<string, string>()
  const best = new Map<string, number>()
  for (const [id, { symbol, value }] of valueById) {
    if (value > (best.get(symbol) ?? -1)) { best.set(symbol, value); idBySymbol.set(symbol, id) }
  }
  return {
    positions: real.filter((p) => !p.fungibleId || idBySymbol.get(assetKey(p.symbol)) === p.fungibleId),
    idBySymbol,
  }
}

/** Total value per token symbol (pass canonical positions). */
export function sumBySymbol(positions: Array<{ symbol: string; value: number }>): Map<string, number> {
  const totals = new Map<string, number>()
  for (const p of positions) {
    const key = assetKey(p.symbol)
    totals.set(key, (totals.get(key) ?? 0) + p.value)
  }
  return totals
}

/** Snapshot metadata: per-token values worth recording (≥ $100, fakes/dust excluded). */
export function snapshotAssetValues(positions: AssetPosition[]): Record<string, number> {
  const { positions: real } = canonicalPositions(positions)
  return Object.fromEntries([...sumBySymbol(real)].filter(([, v]) => v >= SNAPSHOT_ASSET_MIN_USD))
}
