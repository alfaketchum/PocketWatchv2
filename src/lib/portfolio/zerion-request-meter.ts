/**
 * Zerion request meter — the single choke point for every Zerion HTTP request.
 *
 * Counting per governor permit undercounted badly (one permit could cover 13–40
 * requests plus retries, and some callers bypassed the governor entirely), so
 * the daily cap was steering by a number far below what Zerion actually saw.
 * Every request now:
 *   1. checks the daily cap (throws ZerionDailyCapError once reached),
 *   2. waits for a concurrency slot + minimum spacing (no bursts). A 429 puts
 *      THAT key on a cooldown (doubling per consecutive 429); requests on a
 *      cooling key fail fast so callers use the other key or serve cached data,
 *   3. is recorded in ProviderUsageMinute (one row increment per HTTP request).
 */

import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { getMinuteBucket } from "./provider-governor-types"
import { bumpProviderUsageCache, isProviderDailyCapReached, nextUtcMidnight } from "./provider-daily-budget"

const DEFAULT_MAX_CONCURRENCY = 2
// Zerion plan limit is 3 requests/second; 500ms spacing ⇒ at most 2/s (1/3 headroom)
const DEFAULT_MIN_GAP_MS = 500

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const MAX_CONCURRENCY = envInt("ZERION_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY)
const MIN_GAP_MS = envInt("ZERION_MIN_REQUEST_GAP_MS", DEFAULT_MIN_GAP_MS)
/** After a 429, that key waits this long, doubling per consecutive 429 */
const RATE_LIMIT_COOLDOWN_MS = envInt("ZERION_429_COOLDOWN_MS", 30_000)
const RATE_LIMIT_COOLDOWN_MAX_MS = 30 * 60_000

/** Thrown before sending when today's Zerion quota (minus headroom) is used up. */
export class ZerionDailyCapError extends Error {
  readonly status = 429
  constructor() {
    super(`Zerion daily request cap reached — paused until ${nextUtcMidnight().toISOString()}`)
    this.name = "ZerionDailyCapError"
  }
}

/** Thrown before sending when the request's key is cooling down after a 429. */
export class ZerionKeyCoolingDownError extends Error {
  readonly status = 429
  constructor(keyId: string, until: number) {
    super(`Zerion key ${keyId} rate limited — cooling down until ${new Date(until).toISOString()}`)
    this.name = "ZerionKeyCoolingDownError"
  }
}

// On globalThis: Next.js can load a separate copy of this module per route
// bundle, and the concurrency limit only works if every route shares one gate.
interface Waiter { resolve: () => void; background: boolean }
interface KeyState { pausedUntil: number; consecutive429: number }
interface MeterState {
  active: number; lastStartMs: number; waiters: Waiter[]
  keys?: Record<string, KeyState>
}
const g = globalThis as unknown as {
  __pwZerionMeter?: MeterState
  __pwZerionPriority?: AsyncLocalStorage<"background">
}
const state = (g.__pwZerionMeter ??= { active: 0, lastStartMs: 0, waiters: [] })
const priority = (g.__pwZerionPriority ??= new AsyncLocalStorage<"background">())

/**
 * Run background Zerion work (history backfills, daily PnL) at low priority:
 * its requests always yield to requests a page is waiting on, so a long
 * backfill can't make the dashboard wait behind it.
 */
export function runAsBackgroundZerion<T>(work: () => Promise<T>): Promise<T> {
  return priority.run("background", work)
}

/** Short, non-reversible id for an API key (logs + per-key cooldown). */
export function zerionKeyId(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 8)
}

/** Key id from a request's Basic auth header ("Basic base64(key:)"). */
function keyIdFromInit(init: RequestInit): string {
  const auth = new Headers(init.headers).get("authorization") ?? ""
  const encoded = auth.replace(/^Basic\s+/i, "")
  return zerionKeyId(Buffer.from(encoded, "base64").toString("utf8").replace(/:$/, ""))
}

/** Whether this key is cooling down after a 429 (pick another key if so). */
export function isZerionKeyPaused(apiKey: string): boolean {
  return (state.keys?.[zerionKeyId(apiKey)]?.pausedUntil ?? 0) > Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function acquireSlot(): Promise<void> {
  const background = priority.getStore() === "background"
  // Background requests also wait whenever a foreground request is queued
  const mustWait = () => state.active >= MAX_CONCURRENCY
    || (background && state.waiters.some((w) => !w.background))
  while (mustWait()) {
    await new Promise<void>((resolve) => state.waiters.push({ resolve, background }))
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
  // Wake a foreground waiter first; a woken waiter re-checks before taking the slot
  const idx = state.waiters.findIndex((w) => !w.background)
  const [next] = state.waiters.splice(idx >= 0 ? idx : 0, 1)
  next?.resolve()
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
  const keyId = keyIdFromInit(init)
  const keys = (state.keys ??= {})
  const key = (keys[keyId] ??= { pausedUntil: 0, consecutive429: 0 })
  if (key.pausedUntil > Date.now()) throw new ZerionKeyCoolingDownError(keyId, key.pausedUntil)

  await acquireSlot()
  let status: number | null = null
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    status = res.status
    if (status === 429) {
      // Zerion's Retry-After (seconds) when it sends one; otherwise escalate:
      // a 429 right after a cooldown means a longer window is exhausted
      key.consecutive429++
      const retryAfterSec = Number(res.headers.get("retry-after"))
      const cooldown = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.min(retryAfterSec * 1000, RATE_LIMIT_COOLDOWN_MAX_MS)
        : Math.min(RATE_LIMIT_COOLDOWN_MS * 2 ** (key.consecutive429 - 1), RATE_LIMIT_COOLDOWN_MAX_MS)
      key.pausedUntil = Date.now() + cooldown
      // Body says which limit tripped (RPS vs other throttles) — clone so the caller can still read it
      const detail = await res.clone().text().then((t) => t.slice(0, 200)).catch(() => "")
      console.warn(`[zerion-meter] 429 on key ${keyId} (#${key.consecutive429}, retry-after=${res.headers.get("retry-after") ?? "none"}) — cooling it down for ${Math.round(cooldown / 1000)}s. ${detail}`)
    } else if (res.ok) {
      key.consecutive429 = 0
    }
    return res
  } finally {
    releaseSlot()
    await recordRequest(status).catch((err) => console.warn("[zerion-meter] Failed to record usage:", err))
  }
}
