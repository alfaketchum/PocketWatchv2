/** Helius Wallet API client — fetches Solana wallet balances with USD prices. */

import { withProviderPermit } from "./provider-governor"
import type { ZerionPosition, ZerionWalletData, MultiWalletResult } from "./zerion-client"

const TIMEOUT_MS = 30_000
const BATCH_SIZE = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Helius reports native SOL as a balance entry with this pseudo-mint.
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111111"

interface HeliusBalance {
  mint: string
  symbol?: string
  name?: string
  balance: number
  decimals: number
  usdValue?: number | null
  pricePerToken?: number | null
  logoUri?: string | null
}

interface HeliusBalanceResponse {
  balances?: HeliusBalance[]
  totalUsdValue?: number
  pagination?: { page: number; limit: number; hasMore: boolean }
}

function normalizeHeliusPosition(token: HeliusBalance, address: string): ZerionPosition {
  const isNative = token.mint === NATIVE_SOL_MINT
  return {
    id: isNative ? `helius-sol-native-${address.slice(0, 8)}` : `helius-sol-${token.mint}`,
    symbol: token.symbol || "???",
    name: token.name || "Unknown Token",
    chain: "solana",
    quantity: token.balance,
    price: token.pricePerToken ?? 0,
    value: token.usdValue ?? 0,
    iconUrl: token.logoUri ?? null,
    positionType: "wallet",
    contractAddress: isNative ? null : token.mint,
    protocol: null,
    protocolIcon: null,
    protocolUrl: null,
    isDefi: false,
  }
}

/** Fetch all token balances for a single Solana wallet via Helius. */
export async function fetchHeliusBalances(
  apiKey: string,
  address: string,
): Promise<ZerionPosition[]> {
  const positions: ZerionPosition[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://api.helius.xyz/v1/wallet/${encodeURIComponent(address)}/balances?api-key=${apiKey}&page=${page}`
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      if (res.status === 429) throw Object.assign(new Error("Helius rate limit exceeded"), { status: 429 })
      if (res.status === 401) throw new Error("Invalid Helius API key")
      throw new Error(`Helius API error: ${res.status} ${body.slice(0, 200)}`)
    }

    const json: HeliusBalanceResponse = await res.json()
    if (!Array.isArray(json.balances)) {
      throw new Error("Helius balances response missing `balances` array (API shape changed?)")
    }

    for (const token of json.balances) {
      if (token.balance <= 0 && (token.usdValue ?? 0) <= 0) continue
      positions.push(normalizeHeliusPosition(token, address))
    }

    hasMore = json.pagination?.hasMore === true
    page++
  }

  return positions
}

/** Fetch balances for multiple Solana wallets with controlled concurrency. */
export async function fetchMultiHeliusBalances(
  apiKey: string,
  addresses: string[],
): Promise<MultiWalletResult> {
  const wallets: ZerionWalletData[] = []
  let failedCount = 0

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (address) => {
        const positions = await fetchHeliusBalances(apiKey, address)
        return {
          address,
          totalValue: positions.reduce((sum, p) => sum + p.value, 0),
          positions,
        }
      }),
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === "fulfilled") {
        wallets.push(result.value)
      } else {
        failedCount++
        console.warn(`[helius] Wallet ${batch[j].slice(0, 8)}… failed: ${result.reason?.message}`)
        if (result.reason?.status === 429) throw result.reason // bubble up 429 for fallback
      }
    }

    if (i + BATCH_SIZE < addresses.length) await sleep(50)
  }

  if (wallets.length === 0 && addresses.length > 0) {
    throw new Error(`All ${addresses.length} Helius wallet fetches failed`)
  }

  return { wallets, failedCount }
}
