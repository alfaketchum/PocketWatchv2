/**
 * Portfolio chart breakdowns: Stablecoins vs Digital Assets, or By asset
 * (each token worth ≥ $1,000 today gets a band; Hyperliquid/Lighter one band;
 * everything else is Misc). Totals match the net-worth crypto line (crypto-daily).
 *
 * By-asset history is fetched once per (wallet, token) pair holding ≥ $100 of a
 * tracked token (2 Zerion requests each), in the background; until a pair's
 * history exists its value falls under Misc. Recent days use snapshot values.
 */

import { db } from "@/lib/db"
import { buildBalancesForUser } from "./balances-read"
import { getCachedMultiProviderPositions } from "./multi-balance-cache"
import { getHiddenTokenSymbols } from "./hidden-tokens"
import { getServiceKey } from "./service-keys"
import { loadCryptoDaily, utcDayKey } from "./crypto-daily"
import { loadStablecoinSplit } from "./net-worth-stable-split"
import { STABLECOIN_FUNGIBLE_ID_BY_SYMBOL, sumNetWorthStablecoins } from "./stablecoins"
import { ASSET_BAND_MIN_USD, assetKey, canonicalPositions, isRealPosition, sumBySymbol } from "./asset-values"
import { ensureAssetSeries, loadAssetHistory, type AssetPair } from "./wallet-chart-cache"
import { parseMetadata } from "./snapshot-helpers"
import { normalizeWalletAddress } from "./utils"
import type { CompositionMode, CompositionResponse } from "@/types/composition"


const PAIR_MIN_USD = 100
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

/** Tokens worth ≥ $1,000 today and the (wallet, token) pairs to fetch history for. */
async function trackedAssets(userId: string) {
  const wallets = await db.trackedWallet.findMany({ where: { userId }, select: { address: true, chains: true }, take: 500 })
  const [{ wallets: balances }, hidden, pnlRows] = await Promise.all([
    getCachedMultiProviderPositions(userId, wallets),
    getHiddenTokenSymbols(userId),
    db.tokenPnl.findMany({ where: { userId }, select: { walletAddress: true, symbol: true, fungibleId: true }, take: 5_000 }),
  ])
  // Canonical ids are chosen across ALL wallets, then applied per wallet
  const { idBySymbol } = canonicalPositions(balances.flatMap((w) => w.positions.filter((p) => !hidden.has(p.symbol))))
  const visible = balances.map((w) => ({
    ...w,
    positions: w.positions.filter((p) => !hidden.has(p.symbol) && isRealPosition(p)
      && (!p.fungibleId || idBySymbol.get(assetKey(p.symbol)) === p.fungibleId)),
  }))
  const today = sumBySymbol(visible.flatMap((w) => w.positions))
  const assets = [...today].filter(([, v]) => v >= ASSET_BAND_MIN_USD).sort((a, b) => b[1] - a[1]).map(([symbol]) => symbol)
  const tracked = new Set(assets)

  const pairs: AssetPair[] = []
  for (const w of visible) {
    for (const [symbol, value] of sumBySymbol(w.positions)) {
      if (!tracked.has(symbol) || value < PAIR_MIN_USD) continue
      // Zerion id: the canonical (largest) id for the symbol, else known stablecoin id, else ROI data (Solana)
      const fungibleId = idBySymbol.get(symbol)
        ?? STABLECOIN_FUNGIBLE_ID_BY_SYMBOL[symbol]
        ?? pnlRows.find((r) => r.walletAddress === normalizeWalletAddress(w.address) && assetKey(r.symbol) === symbol)?.fungibleId
      if (fungibleId) pairs.push({ address: w.address, symbol, fungibleId })
    }
  }
  return { assets, pairs, today }
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

async function assetComposition(userId: string, since: Date, daily: Daily): Promise<{ data: CompositionResponse; complete: boolean }> {
  const { assets, pairs, today } = await trackedAssets(userId)
  void getServiceKey(userId, "zerion").then((key) => ensureAssetSeries(userId, key, pairs))
  const [{ bySymbol: history, missing }, snapshots] = await Promise.all([loadAssetHistory(userId, pairs), snapshotAssetsByDay(userId, since)])
  const fills = new Map(assets.map((s) => [s, forwardFill(history.get(s) ?? [])]))
  const todayKey = utcDayKey(Date.now())

  const points = daily.days.map((day) => {
    const { crypto, venues } = daily.cryptoFor(day)
    const snap = snapshots.get(day)
    const values: Record<string, number> = {}
    for (const s of assets) {
      const hist = fills.get(s)!(Date.parse(day)) // always advance the cursor
      values[s] = day === todayKey ? today.get(s) ?? 0 : snap ? snap[s] ?? 0 : hist
    }
    const tracked = assets.reduce((sum, s) => sum + values[s], 0)
    return { t: Date.parse(day), values: { ...values, [VENUES.key]: venues, [MISC.key]: Math.max(0, crypto - venues - tracked) } }
  })
  return {
    data: { mode: "asset", layers: [...assets.map((s) => ({ key: s, label: s })), VENUES, MISC], points },
    complete: missing === 0,
  }
}
