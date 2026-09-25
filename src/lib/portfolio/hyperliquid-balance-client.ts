/**
 * Hyperliquid (HyperCore) balance client — spot tokens + perps equity per EVM address.
 *
 * Uses the public info API (no key). The account total comes from the `portfolio`
 * endpoint, which is Hyperliquid's own spot+perp equity figure and is correct for
 * both "default" and "unifiedAccount" modes (in unified mode perp margin is drawn
 * from spot USDC, so summing spot + perp accountValue would double-count).
 * Perps are reported as the residual: total − spot value.
 *
 * HyperEVM balances are NOT here — Zerion already covers them as chain "hyperevm".
 */

import type { ZerionPosition } from "./zerion-client"
import type { VenuePnlRow } from "@/types/roi"

const INFO_URL = "https://api.hyperliquid.xyz/info"
const TIMEOUT_MS = 15_000
const USDC_TOKEN_INDEX = 0
const MIN_VALUE_USD = 0.01
export const HYPERLIQUID_CHAIN = "hyperliquid"

interface SpotMeta {
  tokens: Array<{ name: string; index: number }>
  universe: Array<{ tokens: [number, number]; index: number }>
}
interface SpotAssetCtx { markPx: string; midPx: string | null }
interface SpotBalance { coin: string; token: number; total: string; entryNtl?: string }
interface PerpPosition {
  position: {
    coin: string; szi: string; leverage: { value: number }
    entryPx?: string; positionValue?: string; unrealizedPnl?: string
  }
}
type PortfolioSeries = Array<[string, { accountValueHistory: Array<[number, string]> }]>

async function info<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const err = new Error(`Hyperliquid info ${String(body.type)} failed: ${res.status}`)
    throw Object.assign(err, { status: res.status })
  }
  return res.json() as Promise<T>
}

/** USD price per spot token index, from each token's USDC pair mark price. */
export async function fetchHyperliquidSpotPrices(): Promise<Map<number, number>> {
  const [meta, ctxs] = await info<[SpotMeta, SpotAssetCtx[]]>({ type: "spotMetaAndAssetCtxs" })
  const prices = new Map<number, number>([[USDC_TOKEN_INDEX, 1]])
  for (const pair of meta.universe) {
    if (pair.tokens[1] !== USDC_TOKEN_INDEX || prices.has(pair.tokens[0])) continue
    const px = Number(ctxs[pair.index]?.markPx ?? ctxs[pair.index]?.midPx)
    if (Number.isFinite(px) && px > 0) prices.set(pair.tokens[0], px)
  }
  return prices
}

/** Latest point of a named portfolio series ("day" = total equity, "allTime" = full history). */
export function portfolioSeries(portfolio: PortfolioSeries, name: string): Array<[number, number]> {
  const entry = portfolio.find(([key]) => key === name)
  return (entry?.[1].accountValueHistory ?? []).map(([ts, v]) => [ts, Number(v)])
}

export async function fetchHyperliquidPortfolio(address: string): Promise<PortfolioSeries> {
  return info<PortfolioSeries>({ type: "portfolio", user: address })
}

function basePosition(address: string, id: string): Omit<ZerionPosition, "symbol" | "name" | "quantity" | "price" | "value" | "positionType" | "isDefi"> {
  return {
    id: `hyperliquid-${address.slice(0, 8)}-${id}`,
    chain: HYPERLIQUID_CHAIN,
    iconUrl: null,
    contractAddress: null,
    protocol: "Hyperliquid",
    protocolIcon: null,
    protocolUrl: "https://app.hyperliquid.xyz",
  }
}

function describePerps(positions: PerpPosition[]): string {
  const open = positions.filter((p) => Number(p.position.szi) !== 0)
  if (open.length === 0) return "Hyperliquid Perps"
  const legs = open.map((p) => `${p.position.coin} ${Number(p.position.szi) > 0 ? "long" : "short"} ${p.position.leverage.value}x`)
  return `Hyperliquid Perps (${legs.join(", ")})`
}

/** All Hyperliquid positions for one address; empty when the address has no account. */
export async function fetchHyperliquidBalances(
  address: string,
  prices: Map<number, number>,
): Promise<ZerionPosition[]> {
  const [portfolio, spot, perp] = await Promise.all([
    fetchHyperliquidPortfolio(address),
    info<{ balances: SpotBalance[] }>({ type: "spotClearinghouseState", user: address }),
    info<{ assetPositions: PerpPosition[] }>({ type: "clearinghouseState", user: address }),
  ])

  const spotPositions: ZerionPosition[] = spot.balances
    .map((b) => {
      const quantity = Number(b.total)
      const price = prices.get(b.token) ?? 0
      return {
        ...basePosition(address, `spot-${b.token}`),
        symbol: b.coin,
        name: `${b.coin} (Hyperliquid spot)`,
        quantity,
        price,
        value: quantity * price,
        positionType: "wallet",
        isDefi: false,
      }
    })
    .filter((p) => p.value >= MIN_VALUE_USD)

  const total = portfolioSeries(portfolio, "day").at(-1)?.[1] ?? 0
  const spotValue = spotPositions.reduce((s, p) => s + p.value, 0)
  const perpEquity = total - spotValue
  if (perpEquity < MIN_VALUE_USD) return spotPositions

  return [
    ...spotPositions,
    {
      ...basePosition(address, "perps"),
      symbol: "USDC",
      name: describePerps(perp.assetPositions),
      quantity: perpEquity,
      price: 1,
      value: perpEquity,
      positionType: "deposit",
      isDefi: true,
    },
  ]
}

// ─── Entry price / PnL for the ROI page ─────────────────────────────────────

function pct(gain: number, cost: number): number | null {
  return cost > 0 ? (gain / cost) * 100 : null
}

/** Open perps + spot holdings with Hyperliquid's own entry and unrealized PnL. */
export async function fetchHyperliquidPnlRows(address: string, prices: Map<number, number>): Promise<VenuePnlRow[]> {
  const [spot, perp] = await Promise.all([
    info<{ balances: SpotBalance[] }>({ type: "spotClearinghouseState", user: address }),
    info<{ assetPositions: PerpPosition[] }>({ type: "clearinghouseState", user: address }),
  ])

  const perps = perp.assetPositions
    .map((a) => a.position)
    .filter((p) => Number(p.szi) !== 0)
    .map((p): VenuePnlRow => {
      const size = Math.abs(Number(p.szi))
      const entryPrice = Number(p.entryPx ?? 0)
      const unrealizedPnl = Number(p.unrealizedPnl ?? 0)
      return {
        venue: "hyperliquid", kind: "perp", walletAddress: address, market: p.coin,
        side: Number(p.szi) > 0 ? "long" : "short", size, entryPrice,
        positionValue: Number(p.positionValue ?? 0), unrealizedPnl,
        roiPct: pct(unrealizedPnl, entryPrice * size), leverage: p.leverage.value,
      }
    })

  // Spot reports the cost of the current balance (entryNtl); USDC has none
  const spots = spot.balances
    .filter((b) => b.token !== USDC_TOKEN_INDEX && Number(b.entryNtl ?? 0) > 0 && Number(b.total) > 0)
    .map((b): VenuePnlRow => {
      const size = Number(b.total)
      const cost = Number(b.entryNtl)
      const value = size * (prices.get(b.token) ?? 0)
      return {
        venue: "hyperliquid", kind: "spot", walletAddress: address, market: b.coin, side: null,
        size, entryPrice: cost / size, positionValue: value, unrealizedPnl: value - cost,
        roiPct: pct(value - cost, cost), leverage: null,
      }
    })

  return [...perps, ...spots]
}
