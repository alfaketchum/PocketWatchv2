/**
 * Per-provider DAILY request budget.
 *
 * The governor (provider-governor.ts) paces calls by interval and backs off on
 * 429s, but it has no notion of a provider's *daily* request quota — so it will
 * happily keep calling until the provider starts rejecting everything (which is
 * how a 2000/day Zerion plan gets exhausted). This module adds a proactive daily
 * cap: it sums the calls already made today from the ProviderUsageMinute table
 * the governor already writes, and lets acquirePermit deny new permits once the
 * cap (minus a safety headroom) is reached. Denied Zerion permits fall through to
 * Alchemy via the existing waterfall in multi-balance-fetcher.
 *
 * Reset window: a UTC calendar day (Zerion's daily quota resets at 00:00 UTC).
 * Usage counts requests the provider actually processed — callCount minus
 * rateLimitedCount — because 429-rejected requests do not consume quota.
 */

import { db } from "@/lib/db"
import type { ProviderName } from "./provider-governor-types"

/** Providers with a known daily request cap. Others are uncapped (null). */
const DEFAULT_DAILY_LIMIT: Partial<Record<ProviderName, number>> = {
  zerion: 2_000,
}

/**
 * Estimated Zerion HTTP calls per wallet per full refresh: positions only (~1 per
 * wallet) — chart history is fetched once per wallet and stored, and the projected
 * chart reuses cached positions. Used to pace refreshes so the daily quota lasts a
 * full day; zerion-request-meter.ts enforces the real per-request count.
 */
const DEFAULT_OPS_PER_WALLET = 1
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Daily request cap for a provider, or null when uncapped. Env-overridable. */
export function getProviderDailyLimit(provider: ProviderName): number | null {
  switch (provider) {
    case "zerion":
      return parsePositiveInt(process.env.ZERION_DAILY_LIMIT, DEFAULT_DAILY_LIMIT.zerion ?? 0) || null
    default:
      return DEFAULT_DAILY_LIMIT[provider] ?? null
  }
}

/**
 * Requests to hold back from the hard cap so in-flight/concurrent calls can't
 * overshoot it. Defaults to 2% of the cap (min 10).
 */
export function getProviderDailyHeadroom(provider: ProviderName, limit: number): number {
  if (provider === "zerion") {
    return parsePositiveInt(process.env.ZERION_DAILY_HEADROOM, Math.max(10, Math.ceil(limit * 0.02)))
  }
  return Math.max(10, Math.ceil(limit * 0.02))
}

/** Start of the current UTC day. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Next UTC midnight — when a UTC-day daily quota resets. */
export function nextUtcMidnight(now: Date = new Date()): Date {
  const start = startOfUtcDay(now)
  return new Date(start.getTime() + MS_PER_DAY)
}

// ─── Wallet-count pacing ────────────────────────────────────────
// Rather than react once the daily counter nears the cap, estimate a refresh's
// cost up front (wallets × ops/wallet) and derive a minimum interval between
// refreshes so the whole daily quota spreads across 24h — the app paces *below*
// the guard and never gets rate-limited.

/** Estimated Zerion calls per wallet per refresh (env-overridable). */
export function getZerionOpsPerWallet(): number {
  return parsePositiveInt(process.env.ZERION_OPS_PER_WALLET_REFRESH, DEFAULT_OPS_PER_WALLET)
}

/** Estimated Zerion HTTP calls a full refresh of `walletCount` wallets will make. */
export function estimateRefreshZerionCalls(walletCount: number): number {
  return Math.max(0, walletCount) * getZerionOpsPerWallet()
}

/**
 * Minimum ms between Zerion-backed refreshes so `estimateRefreshZerionCalls`
 * worth of calls, repeated at this interval, stays within the daily limit.
 * Returns 0 when uncapped or there are no wallets (no pacing needed).
 */
export function getRefreshBudgetIntervalMs(walletCount: number): number {
  const limit = getProviderDailyLimit("zerion")
  const callsPerRefresh = estimateRefreshZerionCalls(walletCount)
  if (limit == null || callsPerRefresh <= 0) return 0
  // refreshes/day = limit / callsPerRefresh  →  interval = day / refreshesPerDay
  return Math.ceil((MS_PER_DAY * callsPerRefresh) / limit)
}

// ─── Usage (cached) ─────────────────────────────────────────────
// A short cache avoids re-aggregating on every permit acquisition within a
// refresh burst. The headroom absorbs the small undercount possible within the
// TTL window, so we never overshoot the hard cap.

interface UsageCacheEntry {
  used: number
  dayStart: number
  expiresAt: number
}
// On globalThis so every route bundle's copy of this module shares one count
const g = globalThis as unknown as { __pwProviderUsage?: Map<ProviderName, UsageCacheEntry> }
const usageCache = (g.__pwProviderUsage ??= new Map())
const USAGE_CACHE_TTL_MS = 10_000

/** Drop the cached daily usage for a provider (call after recording new calls). */
export function invalidateProviderUsageCache(provider: ProviderName): void {
  usageCache.delete(provider)
}

/** Count requests just made into the cached usage, so cap checks stay current between aggregations. */
export function bumpProviderUsageCache(provider: ProviderName, calls: number): void {
  const cached = usageCache.get(provider)
  if (cached && cached.dayStart === startOfUtcDay().getTime()) {
    usageCache.set(provider, { ...cached, used: cached.used + calls })
  }
}

/** Requests this provider has made today (UTC), excluding 429-rejected calls. */
export async function getProviderDailyUsage(provider: ProviderName): Promise<number> {
  const nowMs = Date.now()
  const dayStart = startOfUtcDay().getTime()
  const cached = usageCache.get(provider)
  if (cached && cached.dayStart === dayStart && cached.expiresAt > nowMs) {
    return cached.used
  }

  const agg = await db.providerUsageMinute.aggregate({
    where: { provider, minuteBucket: { gte: new Date(dayStart) } },
    _sum: { callCount: true, rateLimitedCount: true },
  })
  const total = agg._sum.callCount ?? 0
  const rejected = agg._sum.rateLimitedCount ?? 0
  const used = Math.max(0, total - rejected)

  usageCache.set(provider, { used, dayStart, expiresAt: nowMs + USAGE_CACHE_TTL_MS })
  return used
}

export interface DailyBudgetState {
  limit: number | null
  used: number
  remaining: number | null
  reached: boolean
  resetAt: string
}

/** Full daily-budget snapshot for a provider (used by diagnostics). */
export async function getProviderDailyBudget(provider: ProviderName): Promise<DailyBudgetState> {
  const limit = getProviderDailyLimit(provider)
  const used = await getProviderDailyUsage(provider)
  const resetAt = nextUtcMidnight().toISOString()

  if (limit == null) {
    return { limit: null, used, remaining: null, reached: false, resetAt }
  }
  const effectiveCap = Math.max(0, limit - getProviderDailyHeadroom(provider, limit))
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    reached: used >= effectiveCap,
    resetAt,
  }
}

/**
 * True when the provider has hit its daily cap (minus headroom). Cheap for
 * uncapped providers — returns false without a DB query.
 */
export async function isProviderDailyCapReached(provider: ProviderName): Promise<boolean> {
  const limit = getProviderDailyLimit(provider)
  if (limit == null) return false
  const used = await getProviderDailyUsage(provider)
  return used >= Math.max(0, limit - getProviderDailyHeadroom(provider, limit))
}
