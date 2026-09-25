/**
 * Address-keyed trading venues (Hyperliquid, Lighter) for tracked EVM wallets.
 *
 * Venue positions are merged into each EVM wallet's positions. When a venue call
 * fails, the last good result for that address is reused so a transient API error
 * can't silently drop venue value from a saved snapshot.
 */

import type { ZerionPosition, ZerionWalletData } from "./zerion-client"
import { fetchHyperliquidBalances, fetchHyperliquidSpotPrices } from "./hyperliquid-balance-client"
import { fetchLighterBalances, fetchLighterPrices } from "./lighter-balance-client"

type VenueFetcher = (address: string) => Promise<ZerionPosition[]>

interface Venue {
  name: string
  prepare: () => Promise<VenueFetcher>
}

const VENUES: Venue[] = [
  {
    name: "hyperliquid",
    prepare: async () => {
      const prices = await fetchHyperliquidSpotPrices()
      return (address) => fetchHyperliquidBalances(address, prices)
    },
  },
  {
    name: "lighter",
    prepare: async () => {
      const prices = await fetchLighterPrices()
      return (address) => fetchLighterBalances(address, prices)
    },
  },
]

// venue:address(lowercase) → last successful positions
const lastGood = new Map<string, ZerionPosition[]>()

async function fetchVenue(venue: Venue, addresses: string[]): Promise<ZerionPosition[][]> {
  let fetcher: VenueFetcher | null = null
  try {
    fetcher = await venue.prepare()
  } catch (err) {
    console.warn(`[venues] ${venue.name} price fetch failed: ${(err as Error).message}`)
  }

  return Promise.all(addresses.map(async (address) => {
    const key = `${venue.name}:${address.toLowerCase()}`
    if (fetcher) {
      try {
        const positions = await fetcher(address)
        lastGood.set(key, positions)
        return positions
      } catch (err) {
        console.warn(`[venues] ${venue.name} ${address.slice(0, 8)}… failed: ${(err as Error).message}`)
      }
    }
    const fallback = lastGood.get(key)
    if (fallback) console.info(`[venues] ${venue.name} ${address.slice(0, 8)}… using last good result`)
    return fallback ?? []
  }))
}

/** Venue positions per EVM address (lowercase key). Never throws. */
export async function fetchVenuePositions(addresses: string[]): Promise<Map<string, ZerionPosition[]>> {
  const byAddress = new Map<string, ZerionPosition[]>()
  if (addresses.length === 0) return byAddress

  const perVenue = await Promise.all(VENUES.map((v) => fetchVenue(v, addresses)))
  addresses.forEach((address, i) => {
    const positions = perVenue.flatMap((venueResults) => venueResults[i])
    if (positions.length > 0) byAddress.set(address.toLowerCase(), positions)
  })
  return byAddress
}

/** Append venue positions to the matching wallets (immutably). */
export function mergeVenuePositions(
  wallets: ZerionWalletData[],
  venuePositions: Map<string, ZerionPosition[]>,
): ZerionWalletData[] {
  return wallets.map((w) => {
    const extra = venuePositions.get(w.address.toLowerCase())
    if (!extra) return w
    return {
      ...w,
      positions: [...w.positions, ...extra],
      totalValue: w.totalValue + extra.reduce((s, p) => s + p.value, 0),
    }
  })
}
