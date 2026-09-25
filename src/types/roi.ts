/** One token's cost basis and PnL, summed across the wallets that hold it. */
export interface TokenRoiRow {
  fungibleId: string
  symbol: string
  name: string
  chain: string
  iconUrl: string | null
  walletCount: number
  quantity: number
  currentValue: number
  currentPrice: number
  averageBuyPrice: number
  /** Cost of the units still held (current value − unrealized gain) */
  costBasis: number
  realizedGain: number
  unrealizedGain: number
  /** Lifetime realized + unrealized */
  totalGain: number
  /** unrealizedGain / costBasis × 100 — return on what you hold now */
  roiPct: number | null
}

/** An open position on a trading venue, with the venue's own entry price and PnL. */
export interface VenuePnlRow {
  venue: "hyperliquid" | "lighter"
  kind: "perp" | "spot"
  walletAddress: string
  market: string
  side: "long" | "short" | null
  size: number
  entryPrice: number
  positionValue: number
  unrealizedPnl: number
  /** unrealizedPnl / cost (entry × size) × 100 */
  roiPct: number | null
  leverage: number | null
}

export interface RoiResponse {
  tokens: TokenRoiRow[]
  venues: VenuePnlRow[]
  totals: { costBasis: number; value: number; realized: number; unrealized: number; totalGain: number; roiPct: number | null }
  refreshedAt: string | null
  refreshing: boolean
}
