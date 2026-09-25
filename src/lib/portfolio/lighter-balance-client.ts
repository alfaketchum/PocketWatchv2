/**
 * Lighter (lighter.xyz) balance client — perps equity + spot assets per EVM address.
 *
 * Uses the public API (no key). Per sub-account, `total_asset_value` is USDC
 * collateral + unrealized perp PnL. Assets with margin disabled (e.g. spot LIT)
 * are NOT part of it and are valued separately from the spot/perp order books.
 */

import type { ZerionPosition } from "./zerion-client"
import type { VenuePnlRow } from "@/types/roi"

const API_BASE = "https://mainnet.zklighter.elliot.ai/api/v1"
const TIMEOUT_MS = 15_000
const ACCOUNT_NOT_FOUND = 21100
const MIN_VALUE_USD = 0.01
const STABLE_SYMBOLS = new Set(["USDC", "USDT", "USDE"])
export const LIGHTER_CHAIN = "lighter"

interface LighterAsset { symbol: string; balance: string; margin_mode: string }
interface LighterPosition {
  symbol: string; sign: number; position: string
  avg_entry_price?: string; position_value?: string; unrealized_pnl?: string
}
interface LighterAccount {
  index: number
  total_asset_value: string
  positions?: LighterPosition[]
  assets?: LighterAsset[]
}
interface OrderBook { symbol: string; last_trade_price: number }

async function lighterGet<T>(path: string): Promise<{ status: number; json: T }> {
  const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  const json = (await res.json().catch(() => ({}))) as T
  return { status: res.status, json }
}

/** USD price per asset symbol: spot "X/USDC" book first, perp "X" book as fallback. */
export async function fetchLighterPrices(): Promise<Map<string, number>> {
  const { status, json } = await lighterGet<{ order_book_details?: OrderBook[]; spot_order_book_details?: OrderBook[] }>("/orderBookDetails")
  if (status !== 200) throw Object.assign(new Error(`Lighter orderBookDetails failed: ${status}`), { status })
  const prices = new Map<string, number>()
  for (const book of json.order_book_details ?? []) {
    if (book.last_trade_price > 0) prices.set(book.symbol, book.last_trade_price)
  }
  for (const book of json.spot_order_book_details ?? []) {
    const [base, quote] = book.symbol.split("/")
    if (quote === "USDC" && book.last_trade_price > 0) prices.set(base, book.last_trade_price)
  }
  return prices
}

function describePerps(positions: LighterPosition[]): string {
  const open = positions.filter((p) => Number(p.position) !== 0)
  if (open.length === 0) return "Lighter Perps"
  return `Lighter Perps (${open.map((p) => `${p.symbol} ${p.sign > 0 ? "long" : "short"}`).join(", ")})`
}

function accountPositions(address: string, account: LighterAccount, prices: Map<string, number>): ZerionPosition[] {
  const base = {
    chain: LIGHTER_CHAIN,
    iconUrl: null,
    contractAddress: null,
    protocol: "Lighter",
    protocolIcon: null,
    protocolUrl: "https://app.lighter.xyz",
  }
  const positions: ZerionPosition[] = []
  const equity = Number(account.total_asset_value)
  if (equity >= MIN_VALUE_USD) {
    positions.push({
      ...base,
      id: `lighter-${address.slice(0, 8)}-${account.index}-perps`,
      symbol: "USDC",
      name: describePerps(account.positions ?? []),
      quantity: equity,
      price: 1,
      value: equity,
      positionType: "deposit",
      isDefi: true,
    })
  }
  for (const asset of account.assets ?? []) {
    if (asset.margin_mode !== "disabled") continue
    const quantity = Number(asset.balance)
    const price = STABLE_SYMBOLS.has(asset.symbol) ? 1 : prices.get(asset.symbol) ?? 0
    if (quantity * price < MIN_VALUE_USD) continue
    positions.push({
      ...base,
      id: `lighter-${address.slice(0, 8)}-${account.index}-spot-${asset.symbol}`,
      symbol: asset.symbol,
      name: `${asset.symbol} (Lighter spot)`,
      quantity,
      price,
      value: quantity * price,
      positionType: "wallet",
      isDefi: false,
    })
  }
  return positions
}

/** All Lighter positions for one address across its sub-accounts; empty when no account. */
export async function fetchLighterBalances(
  address: string,
  prices: Map<string, number>,
): Promise<ZerionPosition[]> {
  const { status, json } = await lighterGet<{ code?: number; accounts?: LighterAccount[] }>(
    `/account?by=l1_address&value=${encodeURIComponent(address)}`,
  )
  if (json.code === ACCOUNT_NOT_FOUND) return []
  if (status !== 200) throw Object.assign(new Error(`Lighter account fetch failed: ${status}`), { status })
  return (json.accounts ?? []).flatMap((a) => accountPositions(address, a, prices))
}

// ─── Entry price / PnL for the ROI page ─────────────────────────────────────

/** Open perp positions with Lighter's own average entry and unrealized PnL. */
export async function fetchLighterPnlRows(address: string): Promise<VenuePnlRow[]> {
  const { status, json } = await lighterGet<{ code?: number; accounts?: LighterAccount[] }>(
    `/account?by=l1_address&value=${encodeURIComponent(address)}`,
  )
  if (json.code === ACCOUNT_NOT_FOUND) return []
  if (status !== 200) throw Object.assign(new Error(`Lighter account fetch failed: ${status}`), { status })

  return (json.accounts ?? []).flatMap((a) => (a.positions ?? [])
    .filter((p) => Number(p.position) !== 0)
    .map((p): VenuePnlRow => {
      const size = Math.abs(Number(p.position))
      const entryPrice = Number(p.avg_entry_price ?? 0)
      const unrealizedPnl = Number(p.unrealized_pnl ?? 0)
      const cost = entryPrice * size
      return {
        venue: "lighter", kind: "perp", walletAddress: address, market: p.symbol,
        side: p.sign > 0 ? "long" : "short", size, entryPrice,
        positionValue: Number(p.position_value ?? 0), unrealizedPnl,
        roiPct: cost > 0 ? (unrealizedPnl / cost) * 100 : null, leverage: null,
      }
    }))
}
