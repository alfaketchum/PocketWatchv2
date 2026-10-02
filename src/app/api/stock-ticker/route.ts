import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { fetchStockQuotes, type StockQuote } from "@/lib/market/stock-quotes"

interface CachedData {
  stocks: StockQuote[]
  timestamp: number
}

const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes
const MAX_SYMBOLS = 20

const cache = new Map<string, CachedData>()
const CACHE_MAX_SIZE = 200

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const symbolsParam = request.nextUrl.searchParams.get("symbols")
  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 })
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS)

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols" }, { status: 400 })
  }

  // Return cached data if fresh (keyed by sorted symbol list)
  const cacheKey = symbols.sort().join(",")
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ stocks: cached.stocks })
  }

  const stocks = await fetchStockQuotes(symbols)

  if (stocks.length > 0) {
    if (cache.size >= CACHE_MAX_SIZE) cache.delete(cache.keys().next().value!)
    cache.set(cacheKey, { stocks, timestamp: Date.now() })
  }

  return NextResponse.json({ stocks })
}
