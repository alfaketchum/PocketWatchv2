/**
 * Supplemental balance history — holdings the Zerion wallet chart never covers:
 * the Hyperliquid / Lighter venues (HyperCore and Lighter aren't on-chain wallets
 * Zerion tracks). Solana IS covered by the Zerion chart, so it isn't here.
 *
 * Chart history is built from Zerion's per-wallet chart, which lacks these. So:
 *  - live snapshots record how much supplemental value they include,
 *  - the history pipeline strips that out (so Zerion scaling compares like with like),
 *  - and the per-day supplemental series is added back onto every chart point.
 */

import { db } from "@/lib/db"
import { parseMetadata } from "./snapshot-helpers"
import { HYPERLIQUID_CHAIN } from "./hyperliquid-balance-client"
import { LIGHTER_CHAIN } from "./lighter-balance-client"

export const SUPPLEMENTAL_SOURCES = [HYPERLIQUID_CHAIN, LIGHTER_CHAIN] as const
export type SupplementalSource = (typeof SUPPLEMENTAL_SOURCES)[number]
export type SupplementalValues = Record<SupplementalSource, number>

const DAY_MS = 86_400_000
const MAX_HISTORY_ROWS = 20_000

export function utcDay(ms: number): Date {
  return new Date(Math.floor(ms / DAY_MS) * DAY_MS)
}

/** Supplemental value per source from a snapshot chainDistribution ({ chain: usd }). */
export function supplementalFromDistribution(chainDistribution: Record<string, unknown> | null | undefined): SupplementalValues {
  const values = { hyperliquid: 0, lighter: 0 } as SupplementalValues
  for (const source of SUPPLEMENTAL_SOURCES) {
    const v = Number(chainDistribution?.[source] ?? 0)
    values[source] = Number.isFinite(v) ? v : 0
  }
  return values
}

export function sumSupplemental(values: SupplementalValues): number {
  return SUPPLEMENTAL_SOURCES.reduce((s, k) => s + values[k], 0)
}

/** Supplemental value already included in a live snapshot's totals. */
export function snapshotSupplementalValue(metadata: unknown): number {
  const parsed = parseMetadata(metadata)
  if (!parsed) return 0
  if (typeof parsed.supplementalValue === "number") return parsed.supplementalValue
  return sumSupplemental(supplementalFromDistribution(parsed.chainDistribution as Record<string, unknown> | undefined))
}

/**
 * Remove supplemental value from live snapshots so the chart pipeline works purely
 * in "Zerion-covered" terms. Returns new objects; input is untouched.
 */
export function stripSupplementalFromSnapshots<T extends { source: string | null; totalValue: number; metadata: unknown }>(
  snapshots: T[],
): T[] {
  return snapshots.map((s) => {
    if (s.source !== "live_refresh") return s
    const supplemental = snapshotSupplementalValue(s.metadata)
    if (supplemental <= 0) return s
    const parsed = parseMetadata(s.metadata) ?? {}
    const onchain = typeof parsed.onchainTotalValue === "number" ? parsed.onchainTotalValue - supplemental : undefined
    return {
      ...s,
      totalValue: s.totalValue - supplemental,
      metadata: JSON.stringify({ ...parsed, ...(onchain !== undefined ? { onchainTotalValue: onchain } : {}) }),
    }
  })
}

/** Record today's per-source values (upsert — last write of the day wins). */
export async function recordSupplementalToday(userId: string, values: SupplementalValues): Promise<void> {
  const date = utcDay(Date.now())
  await Promise.all(SUPPLEMENTAL_SOURCES.map((source) =>
    db.supplementalBalanceHistory.upsert({
      where: { userId_source_date: { userId, source, date } },
      create: { userId, source, date, value: values[source] },
      update: { value: values[source] },
    }),
  ))
}

/** Replace a source's full daily history (used by the backfill). */
export async function replaceSupplementalHistory(
  userId: string,
  source: SupplementalSource,
  daily: Map<number, number>,
): Promise<number> {
  const rows = [...daily.entries()].map(([dayMs, value]) => ({ userId, source, date: new Date(dayMs), value }))
  await db.$transaction([
    db.supplementalBalanceHistory.deleteMany({ where: { userId, source } }),
    db.supplementalBalanceHistory.createMany({ data: rows }),
  ])
  return rows.length
}

/**
 * Load the per-day supplemental series. Returns a lookup (unix seconds → USD):
 * each source is forward-filled from its latest row on or before that day and is
 * 0 before its first row.
 */
export async function loadSupplementalSeries(userId: string): Promise<(timestampSec: number) => number> {
  const rows = await db.supplementalBalanceHistory.findMany({
    where: { userId },
    select: { source: true, date: true, value: true },
    orderBy: { date: "asc" },
    take: MAX_HISTORY_ROWS,
  })
  const series = SUPPLEMENTAL_SOURCES
    .map((source) => rows.filter((r) => r.source === source).map((r) => ({ t: r.date.getTime(), v: r.value })))
    .filter((list) => list.length > 0)
  if (series.length === 0) return () => 0

  return (timestampSec: number) => {
    const dayMs = utcDay(timestampSec * 1000).getTime()
    return series.reduce((sum, list) => sum + valueOnOrBefore(list, dayMs), 0)
  }
}

function valueOnOrBefore(list: Array<{ t: number; v: number }>, t: number): number {
  let lo = 0
  let hi = list.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (list[mid].t <= t) { found = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  return found >= 0 ? list[found].v : 0
}
