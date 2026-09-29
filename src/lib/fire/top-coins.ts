import { getCached, setCache } from "@/lib/cache"
import { getServiceKey } from "@/lib/portfolio/service-keys"

const CACHE_KEY = "fire:top100-symbols"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 15_000

/** Used when CoinGecko is unreachable: large caps that have held a top-100 rank for years. */
const FALLBACK_TOP_SYMBOLS = [
  "BTC", "ETH", "XRP", "BNB", "SOL", "DOGE", "TRX", "ADA", "HYPE", "LINK", "XLM", "SUI", "BCH", "AVAX",
  "HBAR", "LTC", "TON", "SHIB", "DOT", "XMR", "UNI", "NEAR", "APT", "PEPE", "AAVE", "ICP", "ETC", "ONDO",
  "POL", "ATOM", "ALGO", "ARB", "OP", "FIL", "VET", "RENDER", "TAO", "ENA", "INJ", "SEI", "TIA", "MKR",
  "LDO", "JUP", "WLD", "BONK", "STX", "IMX", "GRT", "KAS", "QNT", "FET", "CRV", "SAND", "XTZ", "EOS",
]

export interface TopCoins {
  symbols: Set<string>
  source: TopCoinsSource
}

export type TopCoinsSource = "coingecko" | "coinlore" | "fallback"

async function fetchTop100(apiKey: string | null): Promise<string[]> {
  const base = apiKey ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3"
  const headers: Record<string, string> = { accept: "application/json" }
  if (apiKey) headers["x-cg-pro-api-key"] = apiKey
  const res = await fetch(`${base}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1`, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`CoinGecko markets ${res.status}`)
  const rows = (await res.json()) as Array<{ symbol?: string }>
  return rows.map((r) => (r.symbol ?? "").toUpperCase()).filter(Boolean)
}

/** CoinLore: free, keyless, rank-ordered top 100 (CoinGecko blocks many server IPs without a key). */
async function fetchTop100CoinLore(): Promise<string[]> {
  const res = await fetch("https://api.coinlore.net/api/tickers/?start=0&limit=100", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`CoinLore tickers ${res.status}`)
  const body = (await res.json()) as { data?: Array<{ symbol?: string }> }
  return (body.data ?? []).map((r) => (r.symbol ?? "").toUpperCase()).filter(Boolean)
}

const MIN_PLAUSIBLE_COINS = 50

/**
 * Current top-100 symbols by market cap, cached for a day.
 * Tries CoinGecko (user/env key), then CoinLore, then a bundled list.
 */
export async function getTop100Symbols(userId: string): Promise<TopCoins> {
  const cached = getCached<{ symbols: string[]; source: TopCoinsSource }>(CACHE_KEY)
  if (cached) return { symbols: new Set(cached.symbols), source: cached.source }
  const sources: [TopCoinsSource, () => Promise<string[]>][] = [
    ["coingecko", async () => fetchTop100(await getServiceKey(userId, "coingecko"))],
    ["coinlore", fetchTop100CoinLore],
  ]
  for (const [source, load] of sources) {
    try {
      const symbols = await load()
      if (symbols.length < MIN_PLAUSIBLE_COINS) throw new Error(`only ${symbols.length} coins`)
      setCache(CACHE_KEY, { symbols, source }, CACHE_TTL_MS)
      return { symbols: new Set(symbols), source }
    } catch (err) {
      console.warn(`[fire] top-100 via ${source} failed:`, err instanceof Error ? err.message : err)
    }
  }
  return { symbols: new Set(FALLBACK_TOP_SYMBOLS), source: "fallback" }
}
