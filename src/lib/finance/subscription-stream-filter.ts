/**
 * Suppression of provider (Plaid) recurring streams that should NOT resurface as
 * fresh "active" virtual subscriptions — because the user already dismissed or
 * cancelled the matching subscription.
 *
 * This lived inline in the subscriptions route and only handled dismissed subs,
 * which meant cancelling a Plaid-backed sub let its stream re-materialize as
 * active (you "couldn't cancel" it). Extracted here so dismissed + cancelled
 * share one code path and it can be unit-tested.
 */

import { stringSimilarity } from "./normalize"

/** A subscription whose provider stream should be suppressed (dismissed/cancelled). */
export interface SuppressedSub {
  merchantName: string
  amount: number
  accountId?: string | null
}

export interface ProviderStream {
  merchantName: string | null
  description: string
  accountId?: string | null
  lastAmount?: number | null
  averageAmount?: number | null
}

/**
 * The stream's effective name — the merchant when present, else the description.
 * Many streams store the real name only in the description with a blank
 * merchantName, so `merchantName ?? description` (which keeps empty strings)
 * is wrong; use a truthy check.
 */
export function streamName(ps: ProviderStream): string {
  return (ps.merchantName && ps.merchantName.trim()) || ps.description
}

/** True when this provider stream matches one of the suppressed subscriptions. */
export function isSuppressedStream(ps: ProviderStream, suppressed: SuppressedSub[]): boolean {
  const rawName = streamName(ps)
  const name = rawName.toLowerCase()
  const key = `${name}|${ps.accountId ?? ""}`
  const plaidAmt = ps.lastAmount ?? ps.averageAmount ?? 0

  return suppressed.some((d) => {
    const dName = d.merchantName.toLowerCase()
    if (dName === name) return true
    if (`${dName}|${d.accountId ?? ""}` === key) return true
    // Fuzzy name (+ amount) match, mirroring how merge pairs streams to subs.
    const sim = stringSimilarity(d.merchantName, rawName)
    if (sim >= 0.8) return true
    if (sim < 0.6 || plaidAmt === 0) return false
    return Math.abs(d.amount - plaidAmt) / Math.max(d.amount, plaidAmt) <= 0.3
  })
}

/** Drop provider streams that match a dismissed/cancelled subscription. */
export function filterProviderStreams<T extends ProviderStream>(streams: T[], suppressed: SuppressedSub[]): T[] {
  return streams.filter((ps) => !isSuppressedStream(ps, suppressed))
}
