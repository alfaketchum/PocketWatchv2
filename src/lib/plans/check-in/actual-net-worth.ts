import { db } from "@/lib/db"
import { loadCryptoDaily } from "@/lib/portfolio/crypto-daily"

/** Crypto history this far back is enough to forward-fill to a month's last day. */
const CRYPTO_LOOKBACK_DAYS = 45

/**
 * Financial net worth (fiat accounts + crypto, no homes or vehicles) at the end of a past day, the same total
 * Plan vs Actual charts. Null when neither has any history by then. `day` is UTC midnight.
 */
export async function actualFinancialNetWorth(userId: string, day: Date): Promise<number | null> {
  const dayKey = day.toISOString().slice(0, 10)
  const since = new Date(day.getTime() - CRYPTO_LOOKBACK_DAYS * 86_400_000)
  const [fiat, cryptoDaily] = await Promise.all([
    db.financeSnapshot.findFirst({
      where: { userId, date: { lte: day } },
      orderBy: { date: "desc" },
      select: { netWorth: true },
    }),
    // Only past days are asked for, so today's live value is never used.
    loadCryptoDaily(userId, since, 0),
  ])
  const days = cryptoDaily.days.filter((d) => d <= dayKey)
  let crypto: number | null = null
  for (const d of days) crypto = cryptoDaily.cryptoFor(d).crypto
  if (!fiat && crypto === null) return null
  return Math.round(((fiat?.netWorth ?? 0) + (crypto ?? 0)) * 100) / 100
}
