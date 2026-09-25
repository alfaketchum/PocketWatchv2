import { db } from "@/lib/db"
import { getCachedMultiProviderPositions } from "@/lib/portfolio/multi-balance-cache"
import { getAllExchangeCredentials } from "@/lib/portfolio/service-keys"
import { fetchAllExchangeBalances } from "@/lib/portfolio/exchange-client"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"
import { getHiddenTokenSymbols } from "@/lib/portfolio/hidden-tokens"
import { STABLECOIN_SET_VERSION, sumNetWorthStablecoins } from "@/lib/portfolio/stablecoins"
import { snapshotAssetValues } from "@/lib/portfolio/asset-values"
import { recordSupplementalToday, sumSupplemental, supplementalFromDistribution } from "@/lib/portfolio/supplemental-history"

// Simple in-memory cache per user (survives between requests in same worker)
// On globalThis so invalidation from other routes (hidden-tokens, clear-data)
// reaches the same cache the balances route serves from.
const g = globalThis as unknown as { __pwBalancesResponse?: Map<string, { data: object; timestamp: number; ttl: number }> }
export const cache = (g.__pwBalancesResponse ??= new Map())
const CACHE_TTL_MS = 5 * 60_000 // 5 minutes
const PARTIAL_CACHE_TTL_MS = 30_000 // partial fetch — retry soon
const CACHE_MAX_SIZE = 100 // prevent unbounded memory growth in multi-tenant deployments

export function getFreshCachedResponse(userId: string): object | null {
  const cached = cache.get(userId)
  return cached && Date.now() - cached.timestamp < cached.ttl ? cached.data : null
}

function isPartial(data: object): boolean {
  return (data as { isPartialFetch?: boolean }).isPartialFetch === true
}

/**
 * Cache a freshly built response and return what should be served.
 * A partial fetch (e.g. EVM throttled, only Solana returned) never replaces a
 * complete cached response — the complete one is served instead. With nothing
 * better cached, the partial result is cached briefly so it retries soon.
 */
export function cacheBalancesResponse(userId: string, data: object): object {
  if (!isPartial(data)) {
    cacheSet(userId, data, CACHE_TTL_MS)
    return data
  }
  const previous = cache.get(userId)
  if (previous && !isPartial(previous.data)) return previous.data
  cacheSet(userId, data, PARTIAL_CACHE_TTL_MS)
  return data
}

export function invalidateBalancesResponseCache(userId?: string): void {
  if (userId) { cache.delete(userId); return }
  cache.clear()
}

function cacheSet(userId: string, data: object, ttl: number): void {
  // Evict oldest entries if cache exceeds max size
  if (cache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null
    let oldestTs = Infinity
    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTs) {
        oldestTs = entry.timestamp
        oldestKey = key
      }
    }
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(userId, { data, timestamp: Date.now(), ttl })
}

export async function buildBalancesResponse(userId: string): Promise<object> {
  const [wallets, exchangeCreds] = await Promise.all([
    db.trackedWallet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { address: true, chains: true, label: true },
    }),
    getAllExchangeCredentials(userId),
  ])

  // Fetch on-chain + exchange balances in parallel
  const [walletData, exchangeData] = await Promise.all([
    // On-chain via multi-provider (Zerion/Alchemy/Moralis for EVM, Helius/Alchemy for Solana)
    (async () => {
      if (wallets.length === 0) {
        console.warn("[balances] No wallets for user", userId)
        return []
      }
      try {
        console.log(`[balances] Fetching ${wallets.length} wallet(s) for user ${userId}`)
        const { wallets: walletList, failedCount } = await getCachedMultiProviderPositions(
          userId,
          wallets.map((w) => ({ address: w.address, chains: w.chains })),
        )
        console.log(`[balances] Got ${walletList.length} wallet(s) with ${walletList.reduce((s, w) => s + w.positions.length, 0)} total positions — wallets: ${walletList.length}/${wallets.length}${failedCount > 0 ? ` (${failedCount} failed)` : ""}, value: $${walletList.reduce((s, w) => s + w.totalValue, 0).toFixed(2)}`)
        return walletList
      } catch (err) {
        console.error("[balances] Multi-provider fetch failed:", err)
        return null
      }
    })(),
    // Exchange via CCXT
    (async () => {
      if (exchangeCreds.length === 0) return null
      try {
        return await fetchAllExchangeBalances(exchangeCreds, userId)
      } catch (err) {
        console.error("[balances] Exchange fetch failed:", err)
        return null
      }
    })(),
  ])

  // If no wallets and no exchanges, return early
  if (wallets.length === 0 && exchangeCreds.length === 0) {
    return { error: "no_wallets", message: "No wallets or exchanges configured. Add them in Portfolio Settings.", positions: [], totalValue: 0 }
  }

  // If all providers were throttled, try to serve the last cached response
  if (walletData === null && wallets.length > 0) {
    const stale = cache.get(userId)
    if (stale) {
      console.info("[balances] Serving stale cache during Zerion throttle")
      return stale.data
    }
    // No stale cache — fall back to last known snapshot total so at least
    // the headline value is correct even if positions can't be listed
    const lastSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, metadata: true },
    })
    if (lastSnapshot) {
      const meta = typeof lastSnapshot.metadata === "string"
        ? JSON.parse(lastSnapshot.metadata) : lastSnapshot.metadata
      console.info(`[balances] Zerion throttled, no cache — using last snapshot $${lastSnapshot.totalValue.toFixed(0)}`)
      return {
        totalValue: lastSnapshot.totalValue,
        net_usd: lastSnapshot.totalValue,
        onchainTotalValue: meta?.onchainTotalValue ?? lastSnapshot.totalValue,
        exchangeTotalValue: meta?.exchangeTotalValue ?? 0,
        positions: [],
        chainDistribution: meta?.chainDistribution ?? {},
        icons: {},
        wallets: wallets.map((w) => ({ address: w.address, totalValue: 0, label: w.label ?? null })),
        isThrottled: true,
      }
    }
  }

  // Filter out hidden tokens before aggregation
  const hiddenSymbols = await getHiddenTokenSymbols(userId)
  if (hiddenSymbols.size > 0 && walletData) {
    for (const w of walletData) {
      w.positions = w.positions.filter((p: any) => !hiddenSymbols.has(p.symbol))
      w.totalValue = w.positions.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
    }
  }

  // Aggregate on-chain positions
  const allPositions: Record<string, unknown>[] = []
  let onChainTotal = 0

  if (walletData && walletData.length > 0) {
    for (const w of walletData) {
      for (const p of w.positions) {
        allPositions.push({
          ...p,
          wallet: w.address,
          balance: p.quantity,
        })
      }
    }
    onChainTotal = walletData.reduce((sum, w) => sum + w.totalValue, 0)
  }

  // Merge exchange positions (also filter hidden tokens)
  let exchangeTotal = 0
  if (exchangeData && exchangeData.balances.length > 0) {
    for (const b of exchangeData.balances) {
      if (hiddenSymbols.has(b.asset)) continue
      allPositions.push({
        symbol: b.asset,
        name: b.asset,
        chain: "exchange",
        positionType: "exchange",
        value: b.usd_value,
        quantity: b.amount,
        balance: b.amount,
        wallet: `exchange:${b.exchange}`,
        exchange: b.exchange,
        exchangeLabel: b.exchangeLabel,
      })
      exchangeTotal += b.usd_value
    }
  }

  const totalValue = onChainTotal + exchangeTotal

  // Build chain distribution map: { chainId: usdValue }
  const chainDistribution: Record<string, number> = {}
  for (const p of allPositions) {
    const chain = (p as any).chain as string
    const value = (p as any).value as number
    chainDistribution[chain] = (chainDistribution[chain] || 0) + value
  }

  // Build icon map: { symbol: iconUrl }
  const icons: Record<string, string> = {}
  for (const p of allPositions) {
    const pos = p as any
    if (pos.iconUrl && pos.symbol && !icons[pos.symbol]) {
      icons[pos.symbol] = pos.iconUrl
    }
  }

  // Build DeFi positions summary (LP, staking, lending, etc.)
  const defiPositions = allPositions
    .filter((p: any) => p.isDefi === true)
    .map((p: any) => ({
      symbol: p.symbol,
      name: p.name,
      chain: p.chain,
      positionType: p.positionType,
      protocol: p.protocol,
      protocolIcon: p.protocolIcon,
      value: p.value,
      quantity: p.quantity,
    }))
  const defiTotalValue = defiPositions.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)

  // Save a portfolio snapshot for the history chart. Requiring ALL wallets to
  // return in one fetch is unachievable with 100+ rate-limited wallets, so the
  // snapshot was never written and net worth / history flat-lined on a stale
  // value. Instead write when the fetch is SUBSTANTIALLY complete (>=80% of
  // wallets) and not a collapsed partial (>=90% of the last good total), so a few
  // throttled wallets don't block snapshots while a degenerate partial still can't
  // poison the floor.
  const allWalletsReturned = walletData != null && walletData.length === wallets.length
  const coverage = walletData != null && wallets.length > 0 ? walletData.length / wallets.length : 0
  const exchangeIncluded = exchangeCreds.length === 0 || (
    exchangeData != null
    && exchangeData.exchanges.length === exchangeCreds.length
    && exchangeData.exchanges.every((exchange) => !exchange.error)
  )
  const walletAddresses = wallets.map((wallet) => normalizeWalletAddress(wallet.address)).sort((a, b) => a.localeCompare(b))
  const walletFingerprint = walletAddresses.join("|")

  // Gate on VALUE, not wallet count: value is concentrated in a few wallets, so a
  // fetch can hold the full total at well under 100% count-coverage. Write when the
  // total hasn't collapsed vs the last good snapshot (guards a partial that dropped
  // a high-value wallet); this also bootstraps up from the stale ~$29k baseline.
  let substantiallyComplete = allWalletsReturned
  if (!substantiallyComplete && totalValue > 0) {
    const lastGood = await db.portfolioSnapshot.findFirst({
      where: { userId, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true },
    })
    substantiallyComplete = !lastGood || totalValue >= lastGood.totalValue * 0.9
  }

  if (totalValue > 0 && substantiallyComplete && exchangeIncluded) {
    const supplemental = supplementalFromDistribution(chainDistribution)
    if (allWalletsReturned) {
      recordSupplementalToday(userId, supplemental)
        .catch((err) => console.warn("[balances] Failed to record supplemental history:", err))
    }
    // Fire-and-forget the snapshot write so the response returns without waiting on
    // the DB. The only cost is a ~ms window where a chart read could miss this new
    // point (self-heals on the next refresh); the displayed total is unaffected.
    db.portfolioSnapshot.create({
      data: {
        userId,
        totalValue,
        walletCount: wallets.length,
        source: "live_refresh",
        metadata: JSON.stringify({
          chainDistribution,
          walletAddresses,
          walletFingerprint,
          onchainTotalValue: onChainTotal,
          exchangeTotalValue: exchangeTotal,
          // Persist the stablecoin split so net-worth history can track Stablecoins
          // vs Digital Assets accurately over time (not just approximate the ratio).
          stablecoinValue: sumNetWorthStablecoins(allPositions as Array<{ symbol: string; value: number }>),
          stablecoinSet: STABLECOIN_SET_VERSION,
          // Per-token values (≥ $100) so the "By asset" chart has real recent days
          assetValues: snapshotAssetValues(allPositions as Array<{ symbol: string; value: number; chain: string }>),
          // Hyperliquid + Lighter value (absent from Zerion chart history)
          supplementalValue: sumSupplemental(supplemental),
        }),
      },
    }).catch((err) => console.warn("[balances] Failed to save portfolio snapshot:", err))
  } else if (totalValue > 0 && (!substantiallyComplete || !exchangeIncluded)) {
    console.warn(
      `[balances] Skipping snapshot: incomplete fetch — ` +
      `wallets: ${walletData?.length ?? 0}/${wallets.length} (${Math.round(coverage * 100)}%), ` +
      `exchange: ${exchangeIncluded ? "ok" : "failed"}`
    )
  }

  // When partial fetch occurs, use the last known good snapshot total
  // instead of returning the artificially low partial sum to the dashboard.
  const isPartialFetch = !allWalletsReturned || !exchangeIncluded
  let displayTotal = totalValue
  if (isPartialFetch && totalValue > 0) {
    const lastGoodSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true },
    })
    if (lastGoodSnapshot && lastGoodSnapshot.totalValue > totalValue * 1.5) {
      displayTotal = lastGoodSnapshot.totalValue
      console.info(`[balances] Partial fetch: using last known good total $${displayTotal.toFixed(0)} instead of partial $${totalValue.toFixed(0)}`)
    }
  }

  // Always save exchange balance when available — builds up history for
  // blending into the "total" chart scope. Saved independently of the
  // full portfolio snapshot so exchange history grows even on partial fetches.
  if (exchangeTotal > 0) {
    db.exchangeBalanceSnapshot.create({
      data: { userId, totalValue: exchangeTotal },
    }).catch((err) => console.warn("[balances] Failed to save exchange balance snapshot:", err))
  }

  // Build wallet list (on-chain + exchange "wallets")
  const walletList = walletData
    ? walletData.map((w) => ({
        address: w.address,
        totalValue: w.totalValue,
        label: wallets.find((ww) => ww.address === w.address)?.label ?? null,
      }))
    : []

  // Add exchange summaries as "wallets" with isExchange flag
  if (exchangeData) {
    for (const ex of exchangeData.exchanges) {
      walletList.push({
        address: `exchange:${ex.id}`,
        totalValue: ex.totalValue,
        label: ex.label,
        isExchange: true,
        exchangeId: ex.id,
      } as any)
    }
  }

  return {
    totalValue: displayTotal,
    net_usd: displayTotal, // alias for backward-compat
    onchainTotalValue: isPartialFetch ? displayTotal - exchangeTotal : onChainTotal,
    exchangeTotalValue: exchangeTotal,
    isPartialFetch,
    positions: allPositions,
    chainDistribution,
    icons,
    wallets: walletList,
    defiSummary: {
      totalValue: defiTotalValue,
      positionCount: defiPositions.length,
      positions: defiPositions,
    },
    ...(exchangeData ? { exchangeSummary: exchangeData.exchanges } : {}),
  }
}
