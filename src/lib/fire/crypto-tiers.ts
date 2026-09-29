import { isStableLikeSymbol, normalizeSymbolForPricing } from "@/lib/portfolio/price-symbol-utils"
import { isNetWorthStablecoin } from "@/lib/portfolio/stablecoins"

export type CryptoTier = "btc" | "eth" | "top100" | "longTail" | "stable"
export type RiskTier = Exclude<CryptoTier, "stable">

export const CRYPTO_TIERS: CryptoTier[] = ["btc", "eth", "top100", "longTail", "stable"]
export const RISK_TIERS: RiskTier[] = ["btc", "eth", "top100", "longTail"]

export const CRYPTO_TIER_LABELS: Record<CryptoTier, string> = {
  btc: "Bitcoin",
  eth: "Ether",
  top100: "Top-100 coins",
  longTail: "Long tail",
  stable: "Stablecoins",
}

/** Wrapped / bridged BTC that tracks BTC's price. */
const BTC_SYMBOLS = new Set(["BTC", "WBTC", "CBBTC", "TBTC", "LBTC", "BTCB", "SOLVBTC", "FBTC", "EBTC"])

/** ETH, wrapped ETH, and liquid-staking / restaking ETH. Exact matches only. */
const ETH_SYMBOLS = new Set([
  "ETH", "WETH", "STETH", "WSTETH", "RETH", "CBETH", "WEETH", "EETH", "EZETH",
  "RSETH", "METH", "FRXETH", "SFRXETH", "OETH", "ANKRETH",
])

export function classifyCryptoSymbol(symbol: string, top100: Set<string>): CryptoTier {
  const normalized = normalizeSymbolForPricing(symbol) ?? symbol.trim().toUpperCase()
  if (isNetWorthStablecoin(normalized) || isStableLikeSymbol(normalized)) return "stable"
  if (BTC_SYMBOLS.has(normalized)) return "btc"
  if (ETH_SYMBOLS.has(normalized)) return "eth"
  if (top100.has(normalized)) return "top100"
  return "longTail"
}

export interface TierPosition {
  symbol: string
  value: number
  positionType: string
}

export interface TierSummary {
  tiers: Record<CryptoTier, number>
  /** Largest symbols per tier, for display. */
  examples: Record<CryptoTier, string[]>
}

const EXAMPLES_PER_TIER = 3

export function emptyTiers(): Record<CryptoTier, number> {
  return { btc: 0, eth: 0, top100: 0, longTail: 0, stable: 0 }
}

/** Dollars per tier. Loans are skipped: the balances reader reports debt as positive value. */
export function summarizeTiers(positions: TierPosition[], top100: Set<string>): TierSummary {
  const tiers = emptyTiers()
  const bySymbol = new Map<CryptoTier, Map<string, number>>(CRYPTO_TIERS.map((t) => [t, new Map()]))
  for (const p of positions) {
    if (p.positionType === "loan" || !(p.value > 0)) continue
    const tier = classifyCryptoSymbol(p.symbol, top100)
    tiers[tier] += p.value
    const symbols = bySymbol.get(tier)!
    const key = p.symbol.trim().toUpperCase()
    symbols.set(key, (symbols.get(key) ?? 0) + p.value)
  }
  const examples = Object.fromEntries(
    CRYPTO_TIERS.map((t) => [
      t,
      [...bySymbol.get(t)!].sort((a, b) => b[1] - a[1]).slice(0, EXAMPLES_PER_TIER).map(([s]) => s),
    ]),
  ) as Record<CryptoTier, string[]>
  return { tiers, examples }
}
