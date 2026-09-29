"use client"

import { useQuery } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"
import type { TierSummary } from "@/lib/fire/crypto-tiers"

interface CryptoTiersResponse extends TierSummary {
  top100Source: "coingecko" | "coinlore" | "fallback"
}

/** Current crypto holdings by risk tier (BTC / ETH / top-100 / long tail / stablecoins). */
export function useFireCryptoTiers(enabled = true) {
  return useQuery({
    queryKey: financeKeys.fireCrypto(),
    queryFn: () => financeFetch<CryptoTiersResponse>("/fire/crypto-tiers"),
    staleTime: 5 * 60_000,
    enabled,
  })
}
