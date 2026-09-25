/**
 * Zerion request meter — the single choke point for every Zerion HTTP request.
 *
 * Counting per governor permit undercounted badly (one permit could cover 13–40
 * requests plus retries, and some callers bypassed the governor entirely), so
 * the daily cap was steering by a number far below what Zerion actually saw.
 * Every request now:
 *   1. checks the daily cap (throws ZerionDailyCapError once reached),
 *   2. waits for a concurrency slot + minimum spacing (no bursts),
 *   3. is recorded in ProviderUsageMinute (one row increment per HTTP request).
 */

import { db } from "@/lib/db"
import { getMinuteBucket } from "./provider-governor-types"
import { bumpProviderUsageCache, isProviderDailyCapReached, nextUtcMidnight } from "./provider-daily-budget"

const DEFAULT_MAX_CONCURRENCY = 2
const DEFAULT_MIN_GAP_MS = 250

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const MAX_CONCURRENCY = envInt("ZERION_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY)
const MIN_GAP_MS = envInt("ZERION_MIN_REQUEST_GAP_MS", DEFAULT_MIN_GAP_MS)

/** Thrown before sending when today's Zerion quota (minus headroom) is used up. */
export class ZerionDailyCapError extends Error {
  readonly status = 429
  constructor() {
    super(`Zerion daily request cap reached — paused until ${nextUtcMidnight().toISOString()}`)
    this.name = "ZerionDailyCapError"
  }
}

// On globalThis: Next.js can load a separate copy of this module per route
// bundle, and the concurrency limit only works if every route shares one gate.
interface MeterState { active: number; lastStartMs: number; waiters: Array<() => void> }
const g = globalThis as unknown as { __pwZerionMeter?: MeterState }
const state = (g.__pwZerionMeter ??= { active: 0, lastStartMs: 0, waiters: [] })

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function acquireSlot(): Promise<void> {
  if (state.active >= MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => state.waiters.push(resolve))
  }
  state.active++
  // Space request starts evenly; reserve our start time before sleeping so
  // concurrent acquirers queue behind us rather than sharing the same gap.
  const startAt = Math.max(Date.now(), state.lastStartMs + MIN_GAP_MS)
  state.lastStartMs = startAt
  const wait = startAt - Date.now()
  if (wait > 0) await sleep(wait)
}

function releaseSlot(): void {
  state.active--
  state.waiters.shift()?.()
}

async function recordRequest(status: number | null): Promise<void> {
  const minuteBucket = getMinuteBucket(new Date())
  const rateLimited = status === 429 ? 1 : 0
  const success = status !== null && status >= 200 && status < 300 ? 1 : 0
  const error = 1 - success - rateLimited
  await db.providerUsageMinute.upsert({
    where: { provider_minuteBucket: { provider: "zerion", minuteBucket } },
    create: { provider: "zerion", minuteBucket, callCount: 1, successCount: success, rateLimitedCount: rateLimited, errorCount: error },
    update: {
      callCount: { increment: 1 }, successCount: { increment: success },
      rateLimitedCount: { increment: rateLimited }, errorCount: { increment: error },
    },
  })
  // 429-rejected requests don't consume quota (matches getProviderDailyUsage)
  if (!rateLimited) bumpProviderUsageCache("zerion", 1)
}

/**
 * Send one metered Zerion request. Every Zerion HTTP call must go through here.
 * The timeout starts once the request is actually sent, not while it queues.
 */
export async function meteredZerionFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (await isProviderDailyCapReached("zerion")) throw new ZerionDailyCapError()

  await acquireSlot()
  let status: number | null = null
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    status = res.status
    return res
  } finally {
    releaseSlot()
    await recordRequest(status).catch((err) => console.warn("[zerion-meter] Failed to record usage:", err))
  }
}
