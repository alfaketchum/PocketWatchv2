/**
 * Per-token cost basis / PnL sync (Zerion wallet PnL endpoint).
 *
 * One Zerion request per wallet returns a per-token breakdown (average buy price,
 * invested, realized / unrealized gain) for up to 100 held tokens. Wallets whose
 * balances come from another provider (Solana via Helius) have no Zerion token
 * ids, so they cost one extra positions request. Refreshed at most once a day;
 * a wallet that fails keeps its previous rows until the next run.
 */

import { db } from "@/lib/db"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { getCachedMultiProviderPositions } from "@/lib/portfolio/multi-balance-cache"
import { fetchWalletPositions, fetchWalletTokenPnl, ZERION_PNL_MAX_FUNGIBLES, type ZerionPosition } from "@/lib/portfolio/zerion-client"
import { isStableLikeSymbol, normalizeSymbolForPricing } from "@/lib/portfolio/price-symbol-utils"
import { SUPPLEMENTAL_SOURCES } from "@/lib/portfolio/supplemental-history"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"

export const TOKEN_PNL_REFRESH_MS = 24 * 60 * 60 * 1000
const RETRY_AFTER_FAILURE_MS = 6 * 60 * 60 * 1000
const MIN_POSITION_USD = 10

const g = globalThis as unknown as { __pwTokenPnlRunning?: Set<string> }
const running = (g.__pwTokenPnlRunning ??= new Set())

/** Per wallet: last success and last attempt (ISO), so one failing wallet doesn't re-run the rest. */
type WalletRuns = Record<string, { ok?: string; tried?: string }>

async function readWalletRuns(userId: string): Promise<WalletRuns> {
  const row = await db.portfolioSetting.findUnique({ where: { userId }, select: { settings: true } })
  const settings = (row?.settings && typeof row.settings === "object" ? row.settings : {}) as { tokenPnlWallets?: WalletRuns }
  return settings.tokenPnlWallets ?? {}
}

async function writeWalletRuns(userId: string, runs: WalletRuns): Promise<void> {
  const json = JSON.stringify({ tokenPnlWallets: runs })
  await db.$executeRaw`
    INSERT INTO "PortfolioSetting" ("id", "userId", "settings")
    VALUES (${crypto.randomUUID()}, ${userId}, ${json}::jsonb)
    ON CONFLICT ("userId") DO UPDATE
    SET settings = "PortfolioSetting".settings || ${json}::jsonb
  `
}

/** Succeeded wallets refresh daily; a wallet whose last attempt failed retries after 6h. */
function isWalletDue(run: { ok?: string; tried?: string } | undefined, now: number): boolean {
  const ok = run?.ok ? Date.parse(run.ok) : 0
  const tried = run?.tried ? Date.parse(run.tried) : 0
  if (tried > ok && now - tried < RETRY_AFTER_FAILURE_MS) return false
  return now - ok >= TOKEN_PNL_REFRESH_MS
}

async function listWallets(userId: string) {
  return db.trackedWallet.findMany({ where: { userId }, select: { address: true, chains: true }, take: 500 })
}

/** Latest successful refresh, and whether any wallet is due now. */
export async function getTokenPnlStatus(userId: string): Promise<{ refreshedAt: string | null; due: boolean; running: boolean }> {
  const [runs, wallets] = await Promise.all([readWalletRuns(userId), listWallets(userId)])
  const now = Date.now()
  const oks = Object.values(runs).map((r) => r.ok).filter((v): v is string => !!v).sort()
  const due = wallets.some((w) => isWalletDue(runs[normalizeWalletAddress(w.address)], now))
  return { refreshedAt: oks.at(-1) ?? null, due, running: running.has(userId) }
}

function isStablecoin(symbol: string): boolean {
  const norm = normalizeSymbolForPricing(symbol)
  return !!norm && isStableLikeSymbol(norm)
}

/** Held, non-stablecoin, non-dust positions (Hyperliquid/Lighter have their own PnL). */
function eligible(positions: ZerionPosition[]): ZerionPosition[] {
  const venueChains = new Set<string>(SUPPLEMENTAL_SOURCES)
  return positions.filter((p) =>
    p.value >= MIN_POSITION_USD && !isStablecoin(p.symbol) && !venueChains.has(p.chain))
}

/** One entry per fungible id (a token can appear as several positions), largest first. */
function byFungible(positions: ZerionPosition[]): Map<string, { position: ZerionPosition; quantity: number; value: number }> {
  const map = new Map<string, { position: ZerionPosition; quantity: number; value: number }>()
  for (const p of [...positions].sort((a, b) => b.value - a.value)) {
    if (!p.fungibleId) continue
    const prev = map.get(p.fungibleId)
    map.set(p.fungibleId, prev
      ? { ...prev, quantity: prev.quantity + p.quantity, value: prev.value + p.value }
      : { position: p, quantity: p.quantity, value: p.value })
  }
  return new Map([...map.entries()].slice(0, ZERION_PNL_MAX_FUNGIBLES))
}

async function syncWallet(userId: string, zerionKey: string, address: string, cached: ZerionPosition[]): Promise<void> {
  const held = eligible(cached)
  if (held.length === 0) {
    await db.tokenPnl.deleteMany({ where: { userId, walletAddress: normalizeWalletAddress(address) } })
    return
  }
  // Balances from another provider (Helius) carry no Zerion ids — ask Zerion once
  const withIds = held.some((p) => p.fungibleId) ? held : eligible(await fetchWalletPositions(zerionKey, address))
  const tokens = byFungible(withIds)
  const pnl = await fetchWalletTokenPnl(zerionKey, address, [...tokens.keys()])

  const walletAddress = normalizeWalletAddress(address)
  const rows = [...tokens.entries()]
    .filter(([id]) => pnl[id])
    .map(([fungibleId, t]) => {
      const p = pnl[fungibleId]
      return {
        userId, walletAddress, fungibleId,
        symbol: t.position.symbol, name: t.position.name, chain: t.position.chain, iconUrl: t.position.iconUrl,
        quantity: t.quantity, currentValue: t.value,
        averageBuyPrice: p.average_buy_price ?? 0, totalInvested: p.total_invested ?? 0,
        netInvested: p.net_invested ?? 0, realizedGain: p.realized_gain ?? 0,
        unrealizedGain: p.unrealized_gain ?? 0, totalGain: p.total_gain ?? 0, totalFee: p.total_fee ?? 0,
      }
    })

  await db.$transaction([
    db.tokenPnl.deleteMany({ where: { userId, walletAddress } }),
    db.tokenPnl.createMany({ data: rows }),
  ])
}

/** Refresh due wallets' token PnL. Never throws; failed wallets keep old rows. */
export async function refreshTokenPnl(userId: string): Promise<{ ok: number; failed: number }> {
  if (running.has(userId)) return { ok: 0, failed: 0 }
  running.add(userId)
  let ok = 0
  let failed = 0
  try {
    const zerionKey = await getServiceKey(userId, "zerion")
    if (!zerionKey) return { ok, failed }

    const [runs, wallets] = await Promise.all([readWalletRuns(userId), listWallets(userId)])
    const now = Date.now()
    const due = wallets.filter((w) => isWalletDue(runs[normalizeWalletAddress(w.address)], now))
    if (due.length === 0) return { ok, failed }

    const { wallets: balances } = await getCachedMultiProviderPositions(userId, wallets)
    const positionsByAddress = new Map(balances.map((w) => [normalizeWalletAddress(w.address), w.positions]))
    const nextRuns: WalletRuns = { ...runs }

    for (const { address } of due) {
      const key = normalizeWalletAddress(address)
      const stamp = new Date().toISOString()
      const cached = positionsByAddress.get(key)
      try {
        // Missing from a partial balance fetch — keep its rows rather than wipe them
        if (!cached) throw new Error("wallet missing from balance fetch")
        await syncWallet(userId, zerionKey, address, cached)
        nextRuns[key] = { ok: stamp, tried: stamp }
        ok++
      } catch (err) {
        nextRuns[key] = { ...nextRuns[key], tried: stamp }
        failed++
        console.warn(`[token-pnl] ${address.slice(0, 10)}… failed: ${(err as Error).message}`)
      }
    }
    await writeWalletRuns(userId, nextRuns)
    console.info(`[token-pnl] refreshed ${ok} wallet(s), ${failed} failed`)
    return { ok, failed }
  } catch (err) {
    console.warn("[token-pnl] refresh failed:", err)
    return { ok, failed: failed + 1 }
  } finally {
    running.delete(userId)
  }
}
