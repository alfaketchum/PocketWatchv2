/**
 * Rebuild the value history of "dead" tokens (ones Zerion can't price, e.g.
 * PERPS) from transaction history — no API calls.
 *
 * Balance = transfers in − out (all wallets; transfers between own wallets
 * cancel). Price = the price implied by the token's own priced transfers
 * (USD ÷ amount): the last known price on or before each day, or the first known
 * price before any. After the token's last transaction its value is 0 (Zerion
 * confirms it's worthless now).
 *
 * Only tokens Zerion has NO price for (so no other source counts them); debt
 * tokens are excluded (liabilities).
 * Guards: a token is only accepted if some was actually sold / sent for real
 * value (an outgoing transfer ≥ $50; airdropped spam can't be sold), its implied
 * prices are consistent (max ÷ min ≤ 1000), and they VARY — one identical price
 * on every transfer was assumed by the price resolver, not observed.
 * Tokens whose rebuilt value never reaches $1,000 are skipped as dust.
 * Stored as SupplementalBalanceHistory sources "token:<SYMBOL>:<contract>" (one per
 * token — each forward-fills independently; the chart groups them by symbol).
 */

import { db } from "@/lib/db"
import { replaceSupplementalHistory, TOKEN_SOURCE_PREFIX, utcDay } from "./supplemental-history"
import { assetKey } from "./asset-values"
import { isNetWorthStablecoin } from "./stablecoins"

const MIN_SOLD_USD = 50
/** Aave/Compound debt tokens are loans (liabilities), not holdings */
const DEBT_SYMBOL = /debt/i
const MAX_PRICE_SPREAD = 1_000
const ASSUMED_PRICE_SPREAD = 1.000_001
const MIN_PEAK_USD = 1_000
const DAY_MS = 86_400_000
const MAX_TXS_PER_TOKEN = 20_000

interface Tx { t: number; direction: string; value: number | null; usdValue: number | null }

export function tokenSource(symbol: string, contract: string): string {
  return `${TOKEN_SOURCE_PREFIX}${assetKey(symbol)}:${contract}`
}

/** Band key (symbol) for a "token:<SYMBOL>:<contract>" source */
export function symbolFromTokenSource(source: string): string {
  return source.slice(TOKEN_SOURCE_PREFIX.length).split(":")[0]
}

/**
 * Daily value series for one token, or null when it fails the guards / is dust.
 * `isStablecoin`: the symbol is one of the net-worth stablecoins, so a constant
 * $1 price is genuine rather than assumed.
 */
export function rebuildTokenSeries(txs: Tx[], isStablecoin = false): Map<number, number> | null {
  const priced = txs
    .filter((x) => (x.value ?? 0) > 0 && (x.usdValue ?? 0) > 0)
    .map((x) => ({ t: x.t, price: x.usdValue! / x.value! }))
  const soldForValue = txs.some((x) => x.direction === "out" && (x.usdValue ?? 0) >= MIN_SOLD_USD)
  if (priced.length === 0 || !soldForValue) return null
  const prices = priced.map((p) => p.price)
  const spread = Math.max(...prices) / Math.min(...prices)
  if (spread > MAX_PRICE_SPREAD) return null
  // One identical price on every transfer means the price resolver ASSUMED it
  // (e.g. "*USD*" → $1 for hUSDC shares, "*ETH*" → today's ETH price for LP
  // tokens) — not a market price. Real trades show varying prices.
  if (!isStablecoin && spread < ASSUMED_PRICE_SPREAD) return null

  const firstDay = utcDay(txs[0].t).getTime()
  const lastDay = utcDay(txs[txs.length - 1].t).getTime()
  const daily = new Map<number, number>()
  let balance = 0
  let txIdx = 0
  let priceIdx = -1
  let peak = 0
  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    const endOfDay = day + DAY_MS
    while (txIdx < txs.length && txs[txIdx].t < endOfDay) {
      const x = txs[txIdx++]
      balance = Math.max(0, balance + (x.direction === "in" ? 1 : -1) * (x.value ?? 0))
    }
    while (priceIdx + 1 < priced.length && priced[priceIdx + 1].t < endOfDay) priceIdx++
    const value = balance * priced[Math.max(priceIdx, 0)].price
    peak = Math.max(peak, value)
    daily.set(day, value)
  }
  daily.set(lastDay + DAY_MS, 0) // worthless after its last transaction
  return peak >= MIN_PEAK_USD ? daily : null
}

/** Rebuild every dead token's history (idempotent). Returns how many were stored. */
export async function rebuildDeadTokenHistory(userId: string): Promise<{ stored: number; rejected: number }> {
  const dead = await db.assetCandidate.findMany({ where: { userId, status: "dead" }, take: 2_000 })
  const series: Array<{ source: string; daily: Map<number, number> }> = []
  let rejected = 0

  for (const token of dead) {
    if (DEBT_SYMBOL.test(token.symbol)) {
      rejected++
      continue
    }
    const rows = await db.transactionCache.findMany({
      where: { userId, chain: token.chain, asset: { equals: token.contract, mode: "insensitive" } },
      select: { blockTimestamp: true, direction: true, value: true, usdValue: true },
      orderBy: { blockTimestamp: "asc" },
      take: MAX_TXS_PER_TOKEN,
    })
    const daily = rebuildTokenSeries(
      rows.map((r) => ({ t: r.blockTimestamp * 1000, direction: r.direction, value: r.value, usdValue: r.usdValue })),
      isNetWorthStablecoin(token.symbol),
    )
    if (!daily) {
      rejected++
      continue
    }
    series.push({ source: tokenSource(token.symbol, token.contract), daily })
  }

  // Replace all token:* sources so removed/rejected tokens don't linger
  await db.supplementalBalanceHistory.deleteMany({ where: { userId, source: { startsWith: TOKEN_SOURCE_PREFIX } } })
  for (const { source, daily } of series) {
    await replaceSupplementalHistory(userId, source, daily)
  }
  return { stored: series.length, rejected }
}
