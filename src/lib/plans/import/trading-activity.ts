import { db } from "@/lib/db"
import { detectTrading, type TradeRow, type TradingActivity } from "../trading-detect"
import { taxTreatmentFor, type ImportAccountRow } from "./import-mapping"

/** Plaid serves up to 24 months of investment transactions. */
const HISTORY_MONTHS = 24
const MAX_TRADES = 20_000

/** Trade history of the user's taxable brokerage accounts, read as trading activity (by finance account id). */
export async function loadTradingActivity(userId: string, rows: ImportAccountRow[]): Promise<Record<string, TradingActivity>> {
  const brokerage = rows.filter((r) => taxTreatmentFor(r.type, r.subtype) === "taxable" && (r.currentBalance ?? 0) > 0)
  if (brokerage.length === 0) return {}
  const since = new Date()
  since.setMonth(since.getMonth() - HISTORY_MONTHS)
  const trades = await db.financeInvestmentTransaction.findMany({
    where: { userId, accountId: { in: brokerage.map((r) => r.id) }, type: { in: ["buy", "sell"] }, date: { gte: since } },
    select: { accountId: true, date: true, type: true, quantity: true, amount: true, securityId: true },
    orderBy: { date: "asc" },
    take: MAX_TRADES,
  })
  const byAccount = new Map<string, TradeRow[]>()
  for (const t of trades) {
    const row: TradeRow = { date: t.date, type: t.type === "buy" ? "buy" : "sell", quantity: t.quantity ?? 0, amount: t.amount, securityId: t.securityId }
    byAccount.set(t.accountId, [...(byAccount.get(t.accountId) ?? []), row])
  }
  return Object.fromEntries(brokerage.map((r) => [r.id, detectTrading(byAccount.get(r.id) ?? [], r.currentBalance ?? 0)]))
}
