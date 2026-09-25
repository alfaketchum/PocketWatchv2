/**
 * Daily crypto value history, shared by the net-worth chart and the portfolio
 * composition chart so both show the same totals.
 *
 * Per day: a live snapshot (minus its Hyperliquid/Lighter value) + the venue
 * series + rebuilt dead tokens; else the stored Zerion history + exchange
 * balance + venues + dead tokens. `venues` is returned separately (Hyperliquid/
 * Lighter only) for the stablecoin split and the venue band.
 * Past the end of the Zerion history with no snapshot, the last value carries
 * forward. Today uses the caller's live value.
 */

import { db } from "@/lib/db"
import { isTokenSource, isVenueSource, loadSupplementalSeries } from "./supplemental-history"
import { loadLiveSnapshotByDay } from "./live-snapshot-days"

const MAX_ROWS = 20_000

export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export interface CryptoDaily {
  /** Every day that has crypto data (ascending), today included */
  days: string[]
  /** Call for days in ascending order (forward-fills) */
  cryptoFor: (day: string) => { crypto: number; venues: number }
}

export async function loadCryptoDaily(userId: string, since: Date, todayValue: number): Promise<CryptoDaily> {
  const [chartRows, exchangeSnaps, venuesAt, tokensAt, liveByDay] = await Promise.all([
    db.chartCache.findMany({
      where: { userId, timestamp: { gte: Math.floor(since.getTime() / 1000) } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, value: true },
      take: MAX_ROWS,
    }),
    db.exchangeBalanceSnapshot.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, totalValue: true },
      take: MAX_ROWS,
    }),
    loadSupplementalSeries(userId, isVenueSource),
    loadSupplementalSeries(userId, isTokenSource),
    loadLiveSnapshotByDay(userId, since),
  ])

  const walletByDay = new Map(chartRows.map((r) => [utcDayKey(r.timestamp * 1000), r.value]))
  const exchangeByDay = new Map(exchangeSnaps.map((s) => [utcDayKey(s.createdAt.getTime()), s.totalValue]))
  const todayKey = utcDayKey(Date.now())
  const lastChartDay = [...walletByDay.keys()].at(-1) ?? ""
  const days = [...new Set([...walletByDay.keys(), ...exchangeByDay.keys(), ...liveByDay.keys(), todayKey])].sort()

  let lastWallet = 0
  let lastExchange = 0
  let lastCrypto = 0
  const cryptoFor = (day: string) => {
    lastWallet = walletByDay.get(day) ?? lastWallet
    lastExchange = exchangeByDay.get(day) ?? lastExchange
    const venues = venuesAt(Date.parse(day) / 1000)
    // Dead tokens rebuilt from transactions — neither Zerion nor snapshots count them
    const extra = venues + tokensAt(Date.parse(day) / 1000)
    const live = liveByDay.get(day)
    const crypto = day === todayKey ? todayValue
      : live !== undefined ? live + extra
        : day > lastChartDay ? lastCrypto : lastWallet + lastExchange + extra
    lastCrypto = crypto
    return { crypto, venues }
  }
  return { days, cryptoFor }
}
