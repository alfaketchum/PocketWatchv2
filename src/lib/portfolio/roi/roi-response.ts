/**
 * Builds the ROI page response: stored per-token PnL (aggregated across wallets)
 * plus live Hyperliquid / Lighter positions with the venues' own entry and PnL.
 */

import { db } from "@/lib/db"
import { fetchHyperliquidPnlRows, fetchHyperliquidSpotPrices } from "@/lib/portfolio/hyperliquid-balance-client"
import { fetchLighterPnlRows } from "@/lib/portfolio/lighter-balance-client"
import type { RoiResponse, TokenRoiRow, VenuePnlRow } from "@/types/roi"

const MAX_TOKEN_ROWS = 5_000
/** On-chain tokens worth less than this (summed across wallets) aren't shown */
const MIN_TOKEN_VALUE_USD = 100
/** Venue spot balances below this are leftovers; open perps are always shown */
const MIN_VENUE_SPOT_USD = 100
const VENUE_CACHE_TTL_MS = 5 * 60_000
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

const g = globalThis as unknown as { __pwVenuePnl?: Map<string, { rows: VenuePnlRow[]; at: number }> }
const venueCache = (g.__pwVenuePnl ??= new Map())

function pct(gain: number, cost: number): number | null {
  return cost > 0 ? (gain / cost) * 100 : null
}

type StoredRow = Awaited<ReturnType<typeof loadStoredRows>>[number]

async function loadStoredRows(userId: string) {
  return db.tokenPnl.findMany({ where: { userId }, take: MAX_TOKEN_ROWS })
}

/**
 * Sum one token across wallets. Everything describes the units still held:
 * cost basis = value − unrealized gain, and average entry = cost basis ÷ quantity,
 * so Avg entry × Qty = Cost basis on every row. (Zerion's own average buy price
 * and "invested" include units already sold — a token traded many times shows
 * millions invested in a small holding — so they aren't used here.)
 */
function aggregateToken(rows: StoredRow[]): TokenRoiRow {
  const first = rows[0]
  const sum = (f: (r: StoredRow) => number) => rows.reduce((s, r) => s + f(r), 0)
  const quantity = sum((r) => r.quantity)
  const currentValue = sum((r) => r.currentValue)
  const totalGain = sum((r) => r.totalGain)
  const unrealizedGain = sum((r) => r.unrealizedGain)
  const costBasis = Math.max(0, currentValue - unrealizedGain)
  return {
    fungibleId: first.fungibleId, symbol: first.symbol, name: first.name, chain: first.chain, iconUrl: first.iconUrl,
    walletCount: rows.length, quantity, currentValue,
    currentPrice: quantity > 0 ? currentValue / quantity : 0,
    averageBuyPrice: quantity > 0 ? costBasis / quantity : 0,
    costBasis, realizedGain: sum((r) => r.realizedGain), unrealizedGain,
    totalGain, roiPct: pct(unrealizedGain, costBasis),
  }
}

async function loadVenueRows(userId: string): Promise<VenuePnlRow[]> {
  const cached = venueCache.get(userId)
  if (cached && Date.now() - cached.at < VENUE_CACHE_TTL_MS) return cached.rows

  const wallets = await db.trackedWallet.findMany({ where: { userId }, select: { address: true }, take: 500 })
  const addresses = wallets.map((w) => w.address).filter((a) => EVM_ADDRESS.test(a))
  const prices = await fetchHyperliquidSpotPrices().catch(() => new Map<number, number>())
  const settled = await Promise.allSettled(addresses.flatMap((a) => [fetchHyperliquidPnlRows(a, prices), fetchLighterPnlRows(a)]))
  const failed = settled.filter((r) => r.status === "rejected")
  if (failed.length > 0) {
    console.warn(`[roi] ${failed.length} venue request(s) failed:`, (failed[0] as PromiseRejectedResult).reason?.message)
    if (cached) return cached.rows
  }
  const rows = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))
  if (failed.length === 0) venueCache.set(userId, { rows, at: Date.now() })
  return rows
}

export async function buildRoiResponse(userId: string, status: { refreshedAt: string | null; running: boolean }): Promise<RoiResponse> {
  const [stored, venues] = await Promise.all([loadStoredRows(userId), loadVenueRows(userId)])

  const byToken = new Map<string, StoredRow[]>()
  for (const row of stored) byToken.set(row.fungibleId, [...(byToken.get(row.fungibleId) ?? []), row])
  const tokens = [...byToken.values()]
    .map(aggregateToken)
    .filter((t) => t.currentValue >= MIN_TOKEN_VALUE_USD)
    .sort((a, b) => b.currentValue - a.currentValue)

  const costBasis = tokens.reduce((s, t) => s + t.costBasis, 0)
  const unrealized = tokens.reduce((s, t) => s + t.unrealizedGain, 0)
  return {
    tokens,
    venues: venues
      .filter((v) => v.kind === "perp" || v.positionValue >= MIN_VENUE_SPOT_USD)
      .sort((a, b) => b.positionValue - a.positionValue),
    totals: {
      costBasis,
      value: tokens.reduce((s, t) => s + t.currentValue, 0),
      realized: tokens.reduce((s, t) => s + t.realizedGain, 0),
      unrealized,
      totalGain: tokens.reduce((s, t) => s + t.totalGain, 0),
      roiPct: pct(unrealized, costBasis),
    },
    refreshedAt: status.refreshedAt,
    refreshing: status.running,
  }
}
