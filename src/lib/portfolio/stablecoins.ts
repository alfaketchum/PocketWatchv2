/**
 * What counts as a stablecoin for the net-worth Stablecoins / Digital Assets
 * split — deliberately just these four; everything else is a digital asset.
 * Used for both the live split and the historical split, so they agree.
 */

/** Stamped on snapshots whose stablecoinValue uses this definition. */
export const STABLECOIN_SET_VERSION = "usdc-usdt-usde-usdg"

export const NET_WORTH_STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "USDE", "USDG"])

/** Zerion fungible ids (cross-chain: one id covers every chain's USDC, etc.) */
export const NET_WORTH_STABLECOIN_FUNGIBLE_IDS = [
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "9b76c9cf-ae65-417c-aa37-c544e9248725", // USDe
  "36f00d7d-3909-444c-b6ef-190ca1b64f8a", // USDG
]

export function isNetWorthStablecoin(symbol: string): boolean {
  return NET_WORTH_STABLECOIN_SYMBOLS.has(symbol.trim().toUpperCase())
}

/** USD value of net-worth stablecoins in a set of positions. */
export function sumNetWorthStablecoins(positions: Array<{ symbol: string; value: number }>): number {
  return positions.reduce((s, p) => s + (isNetWorthStablecoin(p.symbol) ? p.value : 0), 0)
}
