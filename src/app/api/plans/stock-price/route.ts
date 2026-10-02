import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { fetchStockQuotes } from "@/lib/market/stock-quotes"

/** Tickers are 1–10 letters, digits, dots or dashes (BRK.B, RDS-A). */
const SYMBOL = /^[A-Z0-9.\-]{1,10}$/

/** GET ?symbol=ACME: the latest price of one stock, for valuing RSUs and options in a plan. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("PLN94", "Authentication required", 401)

  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase() ?? ""
  if (!SYMBOL.test(symbol)) return apiError("PLN95", "Enter a ticker symbol", 400)
  try {
    const [quote] = await fetchStockQuotes([symbol])
    if (!quote || !(quote.price > 0)) return apiError("PLN96", `No price found for ${symbol}`, 404)
    return NextResponse.json({ symbol: quote.symbol, price: quote.price })
  } catch (err) {
    return apiError("PLN97", "Failed to look up the price", 500, err)
  }
}
