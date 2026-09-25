/**
 * Portfolio chart breakdowns: Stablecoins vs Digital Assets, or By asset
 * (each token worth ≥ $1,000 on any day in the range gets a band; Hyperliquid/
 * Lighter one band; everything else is Misc). Totals match the net-worth crypto
 * line (crypto-daily).
 *
 * By-asset sources: Zerion history per tracked (wallet, token) pair — current
 * holdings and past holdings found in transaction history — fetched once in the
 * background (asset-history-job.ts); dead tokens Zerion can't price, rebuilt
 * from transactions; and per-token snapshot values for recent days.
 */

import { db } from "@/lib/db"
import { buildBalancesForUser } from "./balances-read"
import { loadCryptoDaily, utcDayKey } from "./crypto-daily"
import { loadStablecoinSplit } from "./net-worth-stable-split"
import { sumNetWorthStablecoins } from "./stablecoins"
import { ASSET_BAND_MIN_USD } from "./asset-values"
import { loadAssetHistory, type AssetPair } from "./wallet-chart-cache"
import { loadTrackedPairs, runAssetHistoryJob } from "./asset-history-job"
import { currentAssetHoldings } from "./asset-pairs"
import { isTokenSource, loadSupplementalSeriesBySource } from "./supplemental-history"
import { symbolFromTokenSource } from "./dead-token-history"
import { parseMetadata } from "./snapshot-helpers"
import { normalizeWalletAddress } from "./utils"
import type { CompositionMode, CompositionResponse } from "@/types/composition"


const MAX_SNAPSHOTS = 20_000
const CACHE_TTL_MS = 5 * 60_000
const VENUES = { key: "venues", label: "Hyperliquid & Lighter" }
const MISC = { key: "misc", label: "Misc" }

const g = globalThis as unknown as { __pwComposition?: Map<string, { data: CompositionResponse; at: number }> }
const cache = (g.__pwComposition ??= new Map())

export async function buildComposition(userId: string, mode: CompositionMode, since: Date): Promise<CompositionResponse> {
  const cacheKey = `${userId}|${mode}|${utcDayKey(since.getTime())}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  const live = await buildBalancesForUser(userId)
  const todayValue = live.error ? 0 : live.totalValue
  const daily = await loadCryptoDaily(userId, since, todayValue)
  const { data, complete } = mode === "stable"
    ? { data: await stableComposition(userId, since, daily, sumNetWorthStablecoins(live.positions), todayValue), complete: true }
    : await assetComposition(userId, since, daily)
  // Don't cache a by-asset view built while some token history is still being fetched
  if (complete) cache.set(cacheKey, { data, at: Date.now() })
  return data
}

type Daily = Awaited<ReturnType<typeof loadCryptoDaily>>

async function stableComposition(userId: string, since: Date, daily: Daily, todayStable: number, todayValue: number): Promise<CompositionResponse> {
  const stableFor = await loadStablecoinSplit(userId, since)
  const todayKey = utcDayKey(Date.now())
  const ratio = todayValue > 0 ? todayStable / todayValue : 0
  const points = daily.days.map((day) => {
    const { crypto, venues } = daily.cryptoFor(day)
    const stablecoin = day === todayKey ? Math.min(todayStable, crypto)
      : stableFor ? stableFor(day, crypto, venues) : crypto * ratio
    return { t: Date.parse(day), values: { stablecoin, digital: Math.max(0, crypto - stablecoin) } }
  })
  return {
    mode: "stable",
    layers: [{ key: "stablecoin", label: "Stablecoins" }, { key: "digital", label: "Digital Assets" }],
    points,
  }
}

async function snapshotAssetsByDay(userId: string, since: Date): Promise<Map<string, Record<string, number>>> {
  const rows = await db.portfolioSnapshot.findMany({
    where: { userId, source: "live_refresh", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, metadata: true },
    take: MAX_SNAPSHOTS,
  })
  const byDay = new Map<string, Record<string, number>>()
  for (const r of rows) {
    const values = parseMetadata(r.metadata)?.assetValues
    if (values && typeof values === "object") byDay.set(utcDayKey(r.createdAt.getTime()), values as Record<string, number>)
  }
  return byDay
}

/** Forward-filled lookup over an ascending [sec, value] series (call with ascending days). */
function forwardFill(series: [number, number][]) {
  let i = 0
  let last = 0
  return (dayMs: number) => {
    const endOfDaySec = dayMs / 1000 + 86_399
    while (i < series.length && series[i][0] <= endOfDaySec) last = series[i++][1]
    return last
  }
}

/** Bands shown at most (by peak value in range); the rest fold into Misc */
const MAX_BANDS = 20
/** Misc tooltip: its biggest tokens that day (≥ $100) */
const MISC_DETAIL_COUNT = 5
const MISC_DETAIL_MIN_USD = 100

/**
 * By asset, with range-based bands: every token ever tracked (current holdings,
 * past holdings with Zerion history, dead tokens rebuilt from transactions) is
 * valued each day; a token gets a band if it was worth ≥ $1,000 on any day in
 * the range, so a sold token's band doesn't disappear.
 */
async function assetComposition(userId: string, since: Date, daily: Daily): Promise<{ data: CompositionResponse; complete: boolean }> {
  const { pairs: currentPairs, today } = await currentAssetHoldings(userId)
  void runAssetHistoryJob(userId)

  const [storedPairs, deadBySource, snapshots] = await Promise.all([
    loadTrackedPairs(userId),
    loadSupplementalSeriesBySource(userId, isTokenSource),
    snapshotAssetsByDay(userId, since),
  ])
  const pairKey = (p: AssetPair) => `${normalizeWalletAddress(p.address)}|${p.fungibleId}`
  const pairs = [...new Map([...storedPairs, ...currentPairs].map((p) => [pairKey(p), p])).values()]
  const { bySymbol: history, missing } = await loadAssetHistory(userId, pairs)

  const dead = new Map<string, Array<(sec: number) => number>>()
  for (const [source, lookup] of deadBySource) {
    const symbol = symbolFromTokenSource(source)
    dead.set(symbol, [...(dead.get(symbol) ?? []), lookup])
  }
  const symbols = [...new Set([...today.keys(), ...history.keys(), ...dead.keys()])]
  const fills = new Map(symbols.map((s) => [s, forwardFill(history.get(s) ?? [])]))
  const todayKey = utcDayKey(Date.now())

  const rows = daily.days.map((day) => {
    const { crypto, venues } = daily.cryptoFor(day)
    const dayMs = Date.parse(day)
    const snap = snapshots.get(day)
    const values = new Map<string, number>()
    for (const s of symbols) {
      const hist = fills.get(s)!(dayMs) // always advance the cursor
      const deadValue = (dead.get(s) ?? []).reduce((sum, f) => sum + f(dayMs / 1000), 0)
      const zerionValue = day === todayKey ? today.get(s) ?? 0 : snap ? snap[s] ?? 0 : hist
      values.set(s, zerionValue + deadValue)
    }
    return { t: dayMs, crypto, venues, values }
  })

  const peak = new Map(symbols.map((s) => [s, Math.max(0, ...rows.map((r) => r.values.get(s) ?? 0))]))
  const bands = symbols
    .filter((s) => peak.get(s)! >= ASSET_BAND_MIN_USD)
    .sort((a, b) => peak.get(b)! - peak.get(a)!)
    .slice(0, MAX_BANDS)

  const bandSet = new Set(bands)
  const points = rows.map(({ t, crypto, venues, values }) => {
    const bandValues = Object.fromEntries(bands.map((s) => [s, values.get(s) ?? 0]))
    const banded = bands.reduce((sum, s) => sum + bandValues[s], 0)
    const miscTop = [...values]
      .filter(([s, v]) => !bandSet.has(s) && v >= MISC_DETAIL_MIN_USD)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MISC_DETAIL_COUNT)
      .map(([label, value]) => ({ label, value }))
    return {
      t,
      values: { ...bandValues, [VENUES.key]: venues, [MISC.key]: Math.max(0, crypto - venues - banded) },
      ...(miscTop.length > 0 ? { details: { [MISC.key]: miscTop } } : {}),
    }
  })
  return {
    data: { mode: "asset", layers: [...bands.map((s) => ({ key: s, label: s })), VENUES, MISC], points },
    complete: missing === 0,
  }
}
