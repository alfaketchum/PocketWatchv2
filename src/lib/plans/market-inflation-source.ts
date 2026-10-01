/**
 * The bond market's inflation expectations from FRED (St. Louis Fed), no API key: 5- and 10-year
 * breakevens and the 5y5y forward as published; 20- and 30-year breakevens as Treasury minus TIPS yields.
 * Fetched at most once a day and shared by every user (Settings table).
 */

import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import type { MarketInflation } from "./plan-types"
import { latestFromCsv, SERIES, toMarketInflation, type Series } from "./market-inflation-parse"

const CACHE_KEY = "market-inflation"
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const LOOKBACK_DAYS = 30
const TIMEOUT_MS = 15_000


interface Cached {
  data: MarketInflation
  fetchedAt: string
}

async function fetchSeries(id: Series): Promise<{ date: string; value: number }> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${since}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`FRED ${id}: ${res.status}`)
  const latest = latestFromCsv(await res.text())
  if (!latest) throw new Error(`FRED ${id}: no recent value`)
  return latest
}

/** Today's market inflation, from the daily cache or FRED; null when FRED is unreachable and nothing is cached. */
export async function getMarketInflation(): Promise<{ data: MarketInflation; fetchedAt: string } | null> {
  const row = await db.settings.findUnique({ where: { key: CACHE_KEY }, select: { value: true } })
  const cached = row?.value as unknown as Cached | undefined
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < MAX_AGE_MS) return cached
  try {
    const entries = await Promise.all(SERIES.map(async (id) => [id, await fetchSeries(id)] as const))
    const fresh: Cached = { data: toMarketInflation(Object.fromEntries(entries) as Record<Series, { date: string; value: number }>), fetchedAt: new Date().toISOString() }
    const value = fresh as unknown as Prisma.InputJsonValue
    await db.settings.upsert({ where: { key: CACHE_KEY }, create: { key: CACHE_KEY, value }, update: { value } })
    return fresh
  } catch (err) {
    console.warn("[market-inflation] FRED fetch failed:", (err as Error).message)
    return cached ?? null
  }
}
