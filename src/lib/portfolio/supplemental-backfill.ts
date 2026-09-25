/**
 * One-shot backfill of Hyperliquid / Lighter daily value history for a user's
 * tracked EVM addresses (see supplemental-history.ts for how it's used).
 *
 * Hyperliquid: `portfolio` allTime accountValueHistory (spot + perps equity).
 * Lighter:     daily pnl series → equity = inflow − outflow + trade PnL + spot PnL
 *              + value still in the LLP pool (pool_inflow − pool_outflow + pool_pnl).
 */

import { db } from "@/lib/db"
import { fetchHyperliquidPortfolio, portfolioSeries } from "./hyperliquid-balance-client"
import { replaceSupplementalHistory, utcDay, type SupplementalSource } from "./supplemental-history"

const LIGHTER_API = "https://mainnet.zklighter.elliot.ai/api/v1"
const LIGHTER_PNL_START_SEC = 1_600_000_000
const LIGHTER_PNL_MAX_POINTS = 2000
const TIMEOUT_MS = 20_000
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

type Series = Array<[number, number]> // [ms, usd]

interface LighterPnlPoint {
  timestamp: number
  trade_pnl: number
  trade_spot_pnl: number
  inflow: number
  outflow: number
  pool_pnl: number
  pool_inflow: number
  pool_outflow: number
}

async function getJson<T>(url: string): Promise<{ status: number; json: T }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T }
}

async function hyperliquidSeries(address: string): Promise<Series> {
  const portfolio = await fetchHyperliquidPortfolio(address)
  return portfolioSeries(portfolio, "allTime")
}

async function lighterSeries(address: string): Promise<Series> {
  const { json: accounts } = await getJson<{ sub_accounts?: Array<{ index: number }> }>(
    `${LIGHTER_API}/accountsByL1Address?l1_address=${encodeURIComponent(address)}`,
  )
  const perAccount = await Promise.all((accounts.sub_accounts ?? []).map(async ({ index }) => {
    const url = `${LIGHTER_API}/pnl?by=index&value=${index}&resolution=1d` +
      `&start_timestamp=${LIGHTER_PNL_START_SEC}&end_timestamp=${Math.floor(Date.now() / 1000)}&count_back=${LIGHTER_PNL_MAX_POINTS}`
    const { status, json } = await getJson<{ pnl?: LighterPnlPoint[] }>(url)
    if (status !== 200) throw new Error(`Lighter pnl ${index} failed: ${status}`)
    return (json.pnl ?? []).map((p): [number, number] => [
      p.timestamp * 1000,
      p.inflow - p.outflow + p.trade_pnl + p.trade_spot_pnl + (p.pool_inflow - p.pool_outflow + p.pool_pnl),
    ])
  }))
  return sumSeries(perAccount)
}

/** Sum series by UTC day; each series forward-fills from its first point (0 before). */
function sumSeries(seriesList: Series[]): Series {
  const dailyList = seriesList.map((series) => {
    const byDay = new Map<number, number>()
    for (const [ms, v] of [...series].sort((a, b) => a[0] - b[0])) byDay.set(utcDay(ms).getTime(), v)
    return byDay
  })
  const days = [...new Set(dailyList.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b)
  const last = dailyList.map(() => 0)
  return days.map((day): [number, number] => {
    dailyList.forEach((m, i) => { if (m.has(day)) last[i] = m.get(day)! })
    return [day, last.reduce((s, v) => s + Math.max(0, v), 0)]
  })
}

async function backfillSource(
  userId: string,
  source: SupplementalSource,
  addresses: string[],
  fetchSeries: (address: string) => Promise<Series>,
): Promise<number> {
  const perAddress = await Promise.all(addresses.map(fetchSeries))
  const summed = sumSeries(perAddress.filter((s) => s.length > 0))
  return replaceSupplementalHistory(userId, source, new Map(summed))
}

/** Rebuild Hyperliquid + Lighter history for all tracked EVM addresses. */
export async function backfillSupplementalHistory(userId: string): Promise<Record<SupplementalSource, number>> {
  const wallets = await db.trackedWallet.findMany({
    where: { userId },
    select: { address: true },
    take: 500,
  })
  const addresses = wallets.map((w) => w.address).filter((a) => EVM_ADDRESS.test(a))
  const [hyperliquid, lighter] = await Promise.all([
    backfillSource(userId, "hyperliquid", addresses, hyperliquidSeries),
    backfillSource(userId, "lighter", addresses, lighterSeries),
  ])
  return { hyperliquid, lighter }
}
